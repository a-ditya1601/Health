"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useAuth } from "../../context/AuthContext";
import { shortenAddress } from "../../services/blockchain";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

const mockGrantedRecords = [
    {
        recordId: 31,
        patientAddress: "0xPatient001...7f3c",
        patientName: "Anita Rao",
        title: "Cardiology Follow-up Report",
        recordType: "Consultation",
        accessMode: "standard",
        expiresAt: "2026-03-12T11:45:00.000Z",
        aiSummary: {
            medicalSummary: "Stable vitals with ongoing cardiac medication management and no new ischemic symptoms.",
            riskFlags: [{ label: "Cardiac instability", severity: "high" }]
        }
    },
    {
        recordId: 32,
        patientAddress: "0xPatient002...8c1d",
        patientName: "Rahul Sen",
        title: "Diabetes Lab Review",
        recordType: "Lab",
        accessMode: "emergency",
        expiresAt: "2026-03-11T20:00:00.000Z",
        aiSummary: {
            medicalSummary: "Insulin-managed diabetes with elevated glucose trend and recommendation for urgent follow-up.",
            riskFlags: [{ label: "Diabetes risk", severity: "high" }]
        }
    }
];

const mockLogs = [
    {
        id: 1,
        action: "ACCESS_REQUESTED",
        patientAddress: "0xPatient004...19ae",
        timestamp: "2026-03-10T08:20:00.000Z",
        details: "Requested dermatology imaging review"
    },
    {
        id: 2,
        action: "EMERGENCY_ACCESS_REQUESTED",
        patientAddress: "0xPatient002...8c1d",
        timestamp: "2026-03-11T07:45:00.000Z",
        details: "Emergency request submitted for dizziness and hypotension"
    }
];

function formatDate(value) {
    return new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function statusBadge(mode) {
    return mode === "emergency" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700";
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

export default function DoctorDashboardPage() {
    const [patientAddress, setPatientAddress] = useState("");
    const [reason, setReason] = useState("Specialist review of recently uploaded records");
    const [requestState, setRequestState] = useState("");
    const [requestError, setRequestError] = useState("");
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
    const [records, setRecords] = useState(mockGrantedRecords);
    const [logs, setLogs] = useState(mockLogs);
    const {
        address: doctorAddress,
        authError,
        connectWallet,
        hasMetaMask,
        installUrl,
        isAuthenticated,
        isConnecting
    } = useAuth();

    useEffect(() => {
        if (!doctorAddress) {
            setRecords([]);
            setLogs([]);
            return;
        }

        let active = true;

        async function loadDoctorData() {
            try {
                const [recordsRes, logsRes] = await Promise.all([
                    fetch(`${API_BASE}/doctors/${doctorAddress}/records`),
                    fetch(`${API_BASE}/doctors/${doctorAddress}/logs`)
                ]);

                if (!active) return;

                if (recordsRes.ok) {
                    const payload = await recordsRes.json();
                    if (payload?.data?.length) {
                        setRecords(payload.data);
                    }
                }

                if (logsRes.ok) {
                    const payload = await logsRes.json();
                    if (payload?.data?.length) {
                        setLogs(payload.data);
                    }
                }
            } catch (error) {
                console.error("Using doctor dashboard fallback data", error);
            }
        }

        loadDoctorData();
        return () => {
            active = false;
        };
    }, [doctorAddress]);

    const metrics = useMemo(() => {
        const emergencyCount = records.filter((record) => record.accessMode === "emergency").length;
        const totalFlags = records.reduce(
            (count, record) => count + (record.aiSummary?.riskFlags?.length || 0),
            0
        );

        return {
            grantedRecords: records.length,
            emergencyCount,
            totalFlags
        };
    }, [records]);

    async function handleConnectWallet() {
        try {
            await connectWallet();
        } catch (error) {
            console.error("Unable to connect MetaMask", error);
        }
    }

    async function handleAccessRequest(event) {
        event.preventDefault();
        setRequestState("");
        setRequestError("");

        if (!doctorAddress) {
            setRequestError("Connect MetaMask before requesting patient access.");
            return;
        }

        setIsSubmittingRequest(true);

        const payload = {
            patientAddress,
            doctorAddress,
            reason
        };

        try {
            const response = await fetch(`${API_BASE}/doctors/access/request`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-address": doctorAddress
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(result?.message || "Unable to submit access request.");
            }

            const request = result?.data || {};
            setLogs((current) => [
                {
                    id: request.requestId || Date.now(),
                    action: "ACCESS_REQUESTED",
                    patientAddress: request.patientAddress || patientAddress,
                    timestamp: request.createdAt || new Date().toISOString(),
                    details: request.reason || reason
                },
                ...current
            ]);
            setRequestState(result?.message || "Access request submitted to the patient consent ledger.");
            setPatientAddress("");
            setReason("Specialist review of recently uploaded records");
        } catch (error) {
            console.error("Doctor access request failed", error);
            setRequestError(error.message || "Unable to submit access request.");
        } finally {
            setIsSubmittingRequest(false);
        }
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eff8ff_48%,_#fef8ef_100%)] px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl">
                {!isAuthenticated ? (
                    <div className="mb-8 rounded-[2rem] border border-sky-200 bg-white/90 p-6 shadow-lg shadow-slate-200/50">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Wallet Authentication</p>
                        <h2 className="mt-3 text-3xl font-semibold text-slate-900">Connect MetaMask to enter the doctor workspace.</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                            The connected wallet is used as the doctor identity when loading granted records and submitting access requests.
                        </p>
                        <div className="mt-5 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={handleConnectWallet}
                                disabled={!hasMetaMask || isConnecting}
                                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isConnecting ? "Connecting..." : "Connect MetaMask"}
                            </button>
                            {!hasMetaMask ? (
                                <a
                                    href={installUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                    Install MetaMask
                                </a>
                            ) : null}
                        </div>
                        {authError ? <p className="mt-4 text-sm text-rose-600">{authError}</p> : null}
                    </div>
                ) : null}

                <div className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl shadow-slate-300/40">
                    <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-10">
                        <div>
                            <p className="text-sm uppercase tracking-[0.35em] text-sky-300">Doctor Workspace</p>
                            <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
                                Request access, review granted records, and act fast in emergencies.
                            </h1>
                            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                                This dashboard gives doctors a consent-aware view of patient data, AI summaries, and emergency access flows without storing protected files on-chain.
                            </p>
                            <div className="mt-6 flex flex-wrap gap-3">
                                <Link href="/view-records" className="rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300">
                                    View Patient Record
                                </Link>
                                <Link href="/emergency" className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5">
                                    Emergency Request
                                </Link>
                            </div>
                        </div>
                        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                            <p className="text-sm text-slate-300">Doctor wallet</p>
                            <div className="mt-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white">
                                {doctorAddress || "Connect MetaMask to authenticate"}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={handleConnectWallet}
                                    disabled={!hasMetaMask || isConnecting}
                                    className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {doctorAddress ? "Reconnect Wallet" : isConnecting ? "Connecting..." : "Connect MetaMask"}
                                </button>
                                {!hasMetaMask ? (
                                    <a
                                        href={installUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5"
                                    >
                                        Install MetaMask
                                    </a>
                                ) : null}
                            </div>
                            <div className="mt-5 rounded-[1.5rem] bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Current access state</p>
                                <p className="mt-2 text-2xl font-semibold">{metrics.grantedRecords} granted records</p>
                                <p className="mt-1 text-sm text-slate-300">{metrics.emergencyCount} emergency windows and {metrics.totalFlags} active AI flags</p>
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
                    {metricCard("Emergency Windows", metrics.emergencyCount, "Temporary emergency sessions with time-limited access.")}
                    {metricCard("AI Risk Flags", metrics.totalFlags, "Clinical warnings surfaced from report summaries.")}
                </div>

                <div className="mt-8 grid gap-8 xl:grid-cols-[0.88fr_1.12fr]">
                    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Request Access</p>
                        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Ask for patient consent</h2>
                        <form onSubmit={handleAccessRequest} className="mt-6 space-y-4">
                            <input
                                value={patientAddress}
                                onChange={(event) => setPatientAddress(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                                placeholder="Patient wallet address"
                                required
                            />
                            <textarea
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                rows={5}
                                className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                                placeholder="Explain why access is needed"
                            />
                            <button
                                type="submit"
                                disabled={isSubmittingRequest}
                                className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmittingRequest ? "Submitting..." : "Submit Access Request"}
                            </button>
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

                    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-700">Granted Records</p>
                                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Patient files you can view</h2>
                            </div>
                            <Link href="/view-records" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                                Open Viewer
                            </Link>
                        </div>

                        <div className="mt-6 grid gap-4">
                            {records.map((record) => (
                                <article key={record.recordId} className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h3 className="text-xl font-semibold text-slate-900">{record.title}</h3>
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(record.accessMode)}`}>
                                                    {record.accessMode}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-sm text-slate-500">
                                                {record.patientName} • {record.patientAddress}
                                            </p>
                                            <p className="mt-3 text-sm leading-6 text-slate-700">
                                                {record.aiSummary?.medicalSummary}
                                            </p>
                                        </div>
                                        <div className="min-w-52 rounded-2xl bg-slate-950 p-4 text-white">
                                            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Access expires</p>
                                            <p className="mt-2 text-sm">{formatDate(record.expiresAt)}</p>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {(record.aiSummary?.riskFlags || []).map((flag) => (
                                                    <span key={`${record.recordId}-${flag.label}`} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                                                        {flag.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">AI Summaries</p>
                        <div className="mt-5 space-y-4">
                            {records.map((record) => (
                                <div key={`summary-${record.recordId}`} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-lg font-semibold text-slate-900">{record.patientName}</h3>
                                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                                            {record.recordType}
                                        </span>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-slate-700">{record.aiSummary?.medicalSummary}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-700">Recent Activity</p>
                        <div className="mt-5 space-y-4">
                            {logs.map((log) => (
                                <div key={log.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                            {log.action.replaceAll("_", " ")}
                                        </span>
                                        <span className="text-sm text-slate-500">{formatDate(log.timestamp)}</span>
                                    </div>
                                    <p className="mt-3 text-sm font-medium text-slate-900">{log.patientAddress}</p>
                                    <p className="mt-1 text-sm text-slate-600">{log.details}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
