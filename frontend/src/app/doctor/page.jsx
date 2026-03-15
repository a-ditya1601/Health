"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "../../context/AuthContext";
import { shortenAddress } from "../../services/blockchain";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";
const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
});

function shouldRedirectToAuth(message) {
    const normalized = String(message || "").toLowerCase();
    return (
        normalized.includes("doctor is not registered") ||
        normalized.includes("authentication required") ||
        normalized.includes("wallet address is required") ||
        normalized.includes("not authorized")
    );
}

function formatDate(value) {
    if (!value) {
        return "No date available";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return dateFormatter.format(date);
}

function metricCard(label, value, note) {
    return (
        <div className="rounded-[1.75rem] border border-white/60 bg-white/80 p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
            <p className="mt-2 text-sm text-slate-500">{note}</p>
        </div>
    );
}

function normalizeAddress(address) {
    return String(address || "").trim().toLowerCase();
}

function accessStatusBadge(status) {
    if (status === "granted") {
        return "bg-emerald-100 text-emerald-700";
    }

    if (status === "pending") {
        return "bg-amber-100 text-amber-700";
    }

    return "bg-slate-100 text-slate-600";
}

export default function DoctorDashboardPage() {
    const router = useRouter();
    const [records, setRecords] = useState([]);
    const [logs, setLogs] = useState([]);
    const [dashboardError, setDashboardError] = useState("");
    const [newPatientAddress, setNewPatientAddress] = useState("");
    const [requestState, setRequestState] = useState("");
    const [requestError, setRequestError] = useState("");
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
    const {
        address: doctorAddress,
        isAuthenticated,
        isReady
    } = useAuth();

    useEffect(() => {
        if (isReady && !isAuthenticated) {
            router.replace("/auth");
        }
    }, [isAuthenticated, isReady, router]);

    useEffect(() => {
        if (!doctorAddress) {
            setRecords([]);
            setLogs([]);
            setDashboardError("");
            return;
        }

        let active = true;
        setDashboardError("");

        async function loadDoctorData() {
            try {
                const [recordsRes, logsRes] = await Promise.all([
                    fetch(`${API_BASE}/doctors/${doctorAddress}/records`, {
                        headers: {
                            "x-wallet-address": doctorAddress
                        }
                    }),
                    fetch(`${API_BASE}/doctors/${doctorAddress}/logs`, {
                        headers: {
                            "x-wallet-address": doctorAddress
                        }
                    })
                ]);

                if (!active) return;

                const recordsPayload = await recordsRes.json();
                const logsPayload = await logsRes.json();

                if (!recordsRes.ok) {
                    throw new Error(recordsPayload.message || "Unable to load patient directory");
                }

                if (!logsRes.ok) {
                    throw new Error(logsPayload.message || "Unable to load doctor activity");
                }

                setRecords(Array.isArray(recordsPayload?.data) ? recordsPayload.data : []);
                setLogs(Array.isArray(logsPayload?.data) ? logsPayload.data : []);
            } catch (error) {
                console.error("Unable to load doctor dashboard", error);
                if (active) {
                    if (shouldRedirectToAuth(error.message)) {
                        router.replace("/auth");
                        return;
                    }

                    setRecords([]);
                    setLogs([]);
                    setDashboardError(error.message || "Unable to load patient directory");
                }
            }
        }

        loadDoctorData();
        return () => {
            active = false;
        };
    }, [doctorAddress, router]);

    const patientDirectory = useMemo(() => {
        const patientMap = new Map();

        for (const record of records) {
            const patientWallet = normalizeAddress(record.patientAddress);
            if (!patientWallet) {
                continue;
            }

            const existing = patientMap.get(patientWallet) || {
                walletAddress: patientWallet,
                patientName: record.patientName || `Patient ${shortenAddress(patientWallet)}`,
                accessibleRecords: 0,
                lastActivity: null
            };

            existing.accessibleRecords += 1;
            existing.patientName = record.patientName || existing.patientName;

            if (record.createdAt) {
                existing.lastActivity = existing.lastActivity
                    ? new Date(existing.lastActivity) > new Date(record.createdAt)
                        ? existing.lastActivity
                        : record.createdAt
                    : record.createdAt;
            }

            patientMap.set(patientWallet, existing);
        }

        return Array.from(patientMap.values()).sort((a, b) => {
            if (!a.lastActivity) return 1;
            if (!b.lastActivity) return -1;
            return new Date(b.lastActivity) - new Date(a.lastActivity);
        });
    }, [records]);

    const metrics = useMemo(() => {
        const emergencyCount = records.filter((record) => record.accessMode === "emergency").length;

        return {
            patients: patientDirectory.length,
            accessibleRecords: records.length,
            emergencyCount
        };
    }, [patientDirectory.length, records]);

    const patientAccessRows = useMemo(() => {
        const rowMap = new Map();

        for (const record of records) {
            const patientAddress = normalizeAddress(record.patientAddress);
            if (!patientAddress) {
                continue;
            }

            const existing = rowMap.get(patientAddress) || {
                patientAddress,
                status: "no-access",
                lastUpdatedAt: null
            };

            existing.status = "granted";
            existing.lastUpdatedAt = record.createdAt || existing.lastUpdatedAt;
            rowMap.set(patientAddress, existing);
        }

        for (const log of logs) {
            const patientAddress = normalizeAddress(log.patientAddress);

            if (!patientAddress || String(log.action || "").toUpperCase() !== "ACCESS_REQUESTED") {
                continue;
            }

            const existing = rowMap.get(patientAddress) || {
                patientAddress,
                status: "no-access",
                lastUpdatedAt: null
            };

            const requestStatus = String(log.status || "pending").toLowerCase();

            if (existing.status !== "granted") {
                existing.status = requestStatus === "approved" ? "granted" : requestStatus === "pending" ? "pending" : "no-access";
            }

            existing.lastUpdatedAt = log.timestamp || existing.lastUpdatedAt;
            rowMap.set(patientAddress, existing);
        }

        return Array.from(rowMap.values()).sort((a, b) => {
            if (!a.lastUpdatedAt) return 1;
            if (!b.lastUpdatedAt) return -1;
            return new Date(b.lastUpdatedAt) - new Date(a.lastUpdatedAt);
        });
    }, [logs, records]);

    async function handleRequestAccess(event) {
        event.preventDefault();
        setRequestState("");
        setRequestError("");

        if (!doctorAddress) {
            setRequestError("Connect MetaMask before requesting patient access.");
            return;
        }

        if (!newPatientAddress.trim()) {
            setRequestError("Enter Patient Wallet Address.");
            return;
        }

        setIsSubmittingRequest(true);

        try {
            const response = await fetch(`${API_BASE}/doctors/access/request`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-address": doctorAddress
                },
                body: JSON.stringify({
                    doctorAddress,
                    patientAddress: newPatientAddress.trim()
                })
            });

            const result = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(result?.message || "Unable to send access request.");
            }

            setRequestState("Access request sent to patient.");
            setNewPatientAddress("");
            setLogs((current) => [
                {
                    id: Date.now(),
                    action: "ACCESS_REQUESTED",
                    patientAddress: normalizeAddress(newPatientAddress),
                    timestamp: new Date().toISOString(),
                    details: "Access requested from doctor dashboard"
                },
                ...current
            ]);
        } catch (error) {
            setRequestError(error.message || "Unable to send access request.");
        } finally {
            setIsSubmittingRequest(false);
        }
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eff8ff_48%,_#fef8ef_100%)] px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl">
                {dashboardError ? (
                    <div className="mb-8 rounded-[2rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        {dashboardError}
                    </div>
                ) : null}

                <div className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl shadow-slate-300/40">
                    <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-10">
                        <div>
                            <p className="text-sm uppercase tracking-[0.35em] text-sky-300">Doctor Workspace</p>
                            <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
                                Patient Directory
                            </h1>
                            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                                Start with the patient list, then open an individual patient page to handle access and view records.
                            </p>
                        </div>
                        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                            <p className="text-sm text-slate-300">Doctor wallet</p>
                            <div className="mt-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white">
                                {doctorAddress || "Connect MetaMask to authenticate"}
                            </div>
                            <div className="mt-5 rounded-[1.5rem] bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Directory scope</p>
                                <p className="mt-2 text-2xl font-semibold">{metrics.patients} patients</p>
                                <p className="mt-1 text-sm text-slate-300">
                                    {metrics.accessibleRecords} accessible records and {metrics.emergencyCount} emergency windows.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {metricCard(
                        "Doctor Wallet",
                        doctorAddress ? shortenAddress(doctorAddress) : "Not connected",
                        "MetaMask account used as the doctor identity."
                    )}
                    {metricCard("Patients", metrics.patients, "Patients visible from current access grants or prior activity.")}
                    {metricCard("Accessible Records", metrics.accessibleRecords, "Records currently returned by the backend for this doctor.")}
                </div>

                <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Patient Directory</p>
                            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Patients You Have Access To</h2>
                        </div>
                    </div>

                    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                        <table className="min-w-full bg-white text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">Patient Address</th>
                                    <th className="px-4 py-3 text-left font-semibold">Access Status</th>
                                    <th className="px-4 py-3 text-left font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patientAccessRows.length ? (
                                    patientAccessRows.map((row) => (
                                        <tr key={row.patientAddress} className="border-t border-slate-100">
                                            <td className="px-4 py-3 align-middle">
                                                <p className="font-semibold text-slate-900">{shortenAddress(row.patientAddress)}</p>
                                                <p className="mt-1 break-all text-xs text-slate-500">{row.patientAddress}</p>
                                            </td>
                                            <td className="px-4 py-3 align-middle">
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${accessStatusBadge(row.status)}`}>
                                                    {row.status === "granted" ? "Granted" : row.status === "pending" ? "Pending" : "No Access"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 align-middle">
                                                {row.status === "granted" ? (
                                                    <Link
                                                        href={`/doctor/patient/${row.patientAddress}`}
                                                        className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                                                    >
                                                        View Records
                                                    </Link>
                                                ) : row.status === "pending" ? (
                                                    <span className="text-xs font-medium text-amber-700">Awaiting Approval</span>
                                                ) : (
                                                    <span className="text-xs font-medium text-slate-500">No Action</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                                            No patient access data available.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-700">Access Requests</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">Request Access to a Patient</h2>

                    <form onSubmit={handleRequestAccess} className="mt-6 max-w-2xl space-y-4">
                        <input
                            type="text"
                            value={newPatientAddress}
                            onChange={(event) => setNewPatientAddress(event.target.value)}
                            placeholder="Enter Patient Wallet Address"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white"
                        />

                        <div className="flex flex-wrap gap-4">
                            <button
                                type="submit"
                                disabled={isSubmittingRequest}
                                className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmittingRequest ? "Requesting..." : "Request Access"}
                            </button>
                            
                            <button
                                type="button"
                                onClick={() => {
                                    if (newPatientAddress.trim()) {
                                        router.push(`/doctor/patient/${newPatientAddress.trim()}`);
                                    } else {
                                        setRequestError("Enter Patient Wallet Address to view their profile.");
                                    }
                                }}
                                className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Open Patient Profile
                            </button>
                        </div>

                        {requestState ? (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                {requestState}
                            </div>
                        ) : null}

                        {requestError ? (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                                {requestError}
                            </div>
                        ) : null}
                    </form>
                </section>
            </div>
        </div>
    );
}
