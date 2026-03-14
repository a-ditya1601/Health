"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "../../../../context/AuthContext";
import { shortenAddress } from "../../../../services/blockchain";

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

function normalizeAddress(address) {
    return String(address || "").trim().toLowerCase();
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

function formatLogDetails(details) {
    if (!details) {
        return "No additional details";
    }

    if (typeof details === "string") {
        return details;
    }

    return Object.entries(details)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" • ");
}

function extractTimeline(record) {
    const events = Array.isArray(record?.timelineEvents)
        ? record.timelineEvents
        : Array.isArray(record?.aiSummary?.timelineEvents)
            ? record.aiSummary.timelineEvents
            : [];

    return events
        .map((event) => ({
            date: event?.date || null,
            type: event?.type || "Clinical Event",
            finding: event?.finding || "",
            risk: event?.risk || "",
            sourceText: event?.sourceText || ""
        }))
        .filter((event) => event.finding);
}

function accessModeClasses(mode) {
    return mode === "emergency"
        ? "bg-rose-100 text-rose-700"
        : "bg-sky-100 text-sky-700";
}

export default function DoctorPatientPage() {
    const params = useParams();
    const router = useRouter();
    const patientAddress = normalizeAddress(params?.address);
    const {
        address: doctorAddress,
        isAuthenticated,
        isReady
    } = useAuth();

    const [records, setRecords] = useState([]);
    const [logs, setLogs] = useState([]);
    const [pageError, setPageError] = useState("");
    const [requestState, setRequestState] = useState("");
    const [requestError, setRequestError] = useState("");
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
    const [accessKey, setAccessKey] = useState("");
    const [accessKeyState, setAccessKeyState] = useState("");
    const [unlockError, setUnlockError] = useState("");
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [accessState, setAccessState] = useState("pending");

    useEffect(() => {
        if (isReady && !isAuthenticated) {
            router.replace("/auth");
        }
    }, [isAuthenticated, isReady, router]);

    async function loadDoctorData(activeFlag = { current: true }) {
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

            if (!activeFlag.current) return;

            const recordsPayload = await recordsRes.json();
            const logsPayload = await logsRes.json();

            if (!recordsRes.ok) {
                throw new Error(recordsPayload.message || "Unable to load patient records");
            }

            if (!logsRes.ok) {
                throw new Error(logsPayload.message || "Unable to load doctor activity");
            }

            setRecords(Array.isArray(recordsPayload?.data) ? recordsPayload.data : []);
            setLogs(Array.isArray(logsPayload?.data) ? logsPayload.data : []);
        } catch (error) {
            console.error("Unable to load doctor patient page", error);
            if (activeFlag.current) {
                if (shouldRedirectToAuth(error.message)) {
                    router.replace("/auth");
                    return;
                }

                setRecords([]);
                setLogs([]);
                setPageError(error.message || "Unable to load patient records");
            }
        }
    }

    useEffect(() => {
        if (!doctorAddress) {
            setRecords([]);
            setLogs([]);
            setPageError("");
            return;
        }

        const active = { current: true };
        setPageError("");

        loadDoctorData(active);
        return () => {
            active.current = false;
        };
    }, [doctorAddress, router]);

    const patientRecords = useMemo(
        () => records.filter((record) => normalizeAddress(record.patientAddress) === patientAddress),
        [patientAddress, records]
    );

    const patientLogs = useMemo(
        () => logs.filter((log) => normalizeAddress(log.patientAddress) === patientAddress),
        [logs, patientAddress]
    );

    const patientTimeline = useMemo(
        () =>
            patientRecords
                .flatMap((record) =>
                    extractTimeline(record).map((event) => ({
                        ...event,
                        source: record.title || record.fileName || `Record #${record.recordId}`
                    }))
                )
                .sort((a, b) => {
                    if (!a.date) return 1;
                    if (!b.date) return -1;
                    return new Date(a.date) - new Date(b.date);
                }),
        [patientRecords]
    );

    const patientName = useMemo(() => {
        const namedRecord = patientRecords.find((record) => record.patientName);
        return namedRecord?.patientName || `Patient ${shortenAddress(patientAddress)}`;
    }, [patientAddress, patientRecords]);

    const doctorHasAccess = patientRecords.length > 0;

    useEffect(() => {
        if (doctorHasAccess) {
            setAccessState("granted");
            return;
        }

        setAccessState((current) => (current === "granted" ? "pending" : current));
    }, [doctorHasAccess]);

    async function handleRequestAccess(event) {
        event.preventDefault();
        setRequestState("");
        setRequestError("");

        if (!doctorAddress) {
            setRequestError("Connect MetaMask before requesting patient access.");
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
                    patientAddress,
                    doctorAddress
                })
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
                    details: request.reason || "Patient access requested by doctor"
                },
                ...current
            ]);
            setRequestState("Access request sent to patient.");
            setAccessState("waiting-approval");
        } catch (error) {
            console.error("Doctor access request failed", error);
            setRequestError(error.message || "Unable to submit access request.");
        } finally {
            setIsSubmittingRequest(false);
        }
    }

    function handleAccessKeySubmit(event) {
        event.preventDefault();
        setAccessKeyState("");
        setUnlockError("");

        if (!accessKey.trim()) {
            setAccessKeyState("Enter an access key to continue.");
            return;
        }

        if (!doctorAddress) {
            setUnlockError("Connect MetaMask before unlocking records.");
            return;
        }

        setIsUnlocking(true);

        fetch(`${API_BASE}/doctors/access/unlock`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-wallet-address": doctorAddress
            },
            body: JSON.stringify({
                doctorAddress,
                patientAddress,
                accessKey: accessKey.trim()
            })
        })
            .then(async (response) => {
                const result = await response.json().catch(() => null);

                if (!response.ok) {
                    throw new Error(result?.message || "Unable to unlock records.");
                }

                if (Array.isArray(result?.data)) {
                    setRecords(result.data);
                }
                await loadDoctorData({ current: true });
                setAccessKeyState(result?.message || "Records unlocked successfully.");
                setAccessKey("");
                setAccessState("granted");
            })
            .catch((error) => {
                const message = error.message || "Unable to unlock records.";
                setUnlockError(message);
                if (message.toLowerCase().includes("invalid access key")) {
                    setAccessState("invalid-key");
                }
            })
            .finally(() => {
                setIsUnlocking(false);
            });
    }

    const accessStateInfo = useMemo(() => {
        if (accessState === "granted") {
            return {
                label: "Access granted",
                classes: "bg-emerald-100 text-emerald-700",
                message: "You can view records and AI summaries for this patient."
            };
        }

        if (accessState === "requested") {
            return {
                label: "Access requested",
                classes: "bg-sky-100 text-sky-700",
                message: "Request submitted."
            };
        }

        if (accessState === "waiting-approval") {
            return {
                label: "Waiting for patient approval",
                classes: "bg-indigo-100 text-indigo-700",
                message: "Use Unlock Records after the patient shares an access key."
            };
        }

        if (accessState === "invalid-key") {
            return {
                label: "Invalid key",
                classes: "bg-rose-100 text-rose-700",
                message: "The access key was not accepted. Try again or request patient access."
            };
        }

        return {
            label: "Access pending",
            classes: "bg-amber-100 text-amber-700",
            message: "Request access or enter a valid key to unlock records."
        };
    }, [accessState]);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_24%),linear-gradient(180deg,_#f8fbff_0%,_#eff8ff_48%,_#fef8ef_100%)] px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl">
                {pageError ? (
                    <div className="mb-8 rounded-[2rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        {pageError}
                    </div>
                ) : null}

                <div className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl shadow-slate-300/40">
                    <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-10">
                        <div>
                            <p className="text-sm uppercase tracking-[0.35em] text-sky-300">Doctor Workspace</p>
                            <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
                                {patientName}
                            </h1>
                            <p className="mt-4 max-w-2xl break-all text-sm leading-6 text-slate-300">
                                {patientAddress}
                            </p>
                            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                                Review accessible records for this patient or request a permission grant if no current access exists.
                            </p>
                        </div>
                        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                            <p className="text-sm text-slate-300">Doctor wallet</p>
                            <div className="mt-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white">
                                {doctorAddress || "Connect MetaMask to authenticate"}
                            </div>
                            <div className="mt-5 rounded-[1.5rem] bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Access state</p>
                                <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${accessStateInfo.classes}`}>
                                    {accessStateInfo.label}
                                </div>
                                <p className="mt-2 text-sm text-slate-300">{accessStateInfo.message}</p>
                                <p className="mt-2 text-sm font-semibold text-white">
                                    {doctorHasAccess ? `${patientRecords.length} accessible records` : "No active permission"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                        href="/doctor"
                        className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
                    >
                        Back to Patient Directory
                    </Link>
                </div>

                {!doctorHasAccess ? (
                    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Access Gate</p>
                        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Request Access Or Unlock Records</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            You currently do not have access to this patient's records.
                        </p>

                        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-5">
                            <button
                                type="button"
                                onClick={handleRequestAccess}
                                disabled={isSubmittingRequest}
                                className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmittingRequest ? "Submitting..." : "Request Access From Patient"}
                            </button>

                            {requestState ? (
                                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                    {requestState || "Access request sent to patient."}
                                </div>
                            ) : null}

                            {requestError ? (
                                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                                    {requestError}
                                </div>
                            ) : null}

                            <p className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">OR</p>

                            <div className="mt-6">
                                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-700">Enter Access Key</p>
                                <form onSubmit={handleAccessKeySubmit} className="mt-4 space-y-4">
                                    <textarea
                                        value={accessKey}
                                        onChange={(event) => setAccessKey(event.target.value)}
                                        rows={5}
                                        className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white"
                                        placeholder="Enter Access Key"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isUnlocking}
                                        className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isUnlocking ? "Unlocking..." : "Unlock Records"}
                                    </button>
                                    {accessKeyState ? (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                            {accessKeyState}
                                        </div>
                                    ) : null}
                                    {unlockError ? (
                                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                                            {unlockError}
                                        </div>
                                    ) : null}
                                </form>
                            </div>
                        </div>
                    </section>
                ) : (
                    <>
                        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-700">Accessible Records</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">Records</h2>
                                </div>
                            </div>

                            <div className="mt-6 grid gap-4">
                                {patientRecords.map((record) => (
                                    <article
                                        key={record.recordId}
                                        className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5"
                                    >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <h3 className="text-xl font-semibold text-slate-900">
                                                        {record.title || record.fileName || `Record #${record.recordId}`}
                                                    </h3>
                                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accessModeClasses(record.accessMode)}`}>
                                                        {record.accessMode}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm text-slate-500">
                                                    {record.recordType}
                                                </p>
                                                <p className="mt-4 text-sm leading-6 text-slate-700">
                                                    {record.aiSummary?.medicalSummary || "No AI summary available."}
                                                </p>
                                            </div>
                                            <div className="min-w-56 rounded-2xl bg-slate-950 p-4 text-white">
                                                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Expires</p>
                                                <p className="mt-2 text-sm">
                                                    {record.expiresAt ? formatDate(record.expiresAt) : "No expiry provided"}
                                                </p>
                                                <p className="mt-4 text-xs uppercase tracking-[0.25em] text-slate-400">AI Summary</p>
                                                <p className="mt-2 text-sm text-slate-300">
                                                    {record.aiSummary?.medicalSummary || "No AI summary available."}
                                                </p>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>

                        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-700">Recent Activity</p>
                            <div className="mt-5 space-y-4">
                                {patientLogs.length ? (
                                    patientLogs.map((log, index) => (
                                        <div key={log.id || `${log.action}-${log.timestamp}-${index}`} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                    {String(log.action || "").replaceAll("_", " ")}
                                                </span>
                                                <span className="text-sm text-slate-500">{formatDate(log.timestamp)}</span>
                                            </div>
                                            <p className="mt-3 text-sm font-medium text-slate-900">
                                                {log.patientAddress}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-600">{formatLogDetails(log.details)}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                        No activity recorded for this patient yet.
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-700">Medical Timeline</p>
                            <h3 className="mt-2 text-2xl font-semibold text-slate-900">Chronological History</h3>

                            <div className="mt-5 space-y-4">
                                {patientTimeline.length ? (
                                    patientTimeline.map((event, index) => (
                                        <article key={`${event.date}-${event.source}-${index}`} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
                                                    {event.date ? formatDate(event.date) : "Date Unknown"}
                                                </p>
                                                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
                                                    {event.type}
                                                </span>
                                            </div>
                                            <p className="mt-3 text-sm font-medium text-slate-900">{event.finding}</p>
                                            {event.risk ? <p className="mt-1 text-xs text-rose-700">Risk: {event.risk}</p> : null}
                                            <p className="mt-1 text-xs text-slate-500">Source: {event.source}</p>
                                            {event.sourceText ? <p className="mt-2 text-xs text-slate-500">{event.sourceText}</p> : null}
                                        </article>
                                    ))
                                ) : (
                                    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                        No timeline events available for this patient yet.
                                    </div>
                                )}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
