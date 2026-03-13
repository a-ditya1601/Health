"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import AccessLog from "../../components/AccessLog";
import { useAuth } from "../../context/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

function formatDate(value) {
    return new Date(value).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function severityClasses(severity) {
    const map = {
        low: "bg-emerald-100 text-emerald-700",
        medium: "bg-amber-100 text-amber-700",
        high: "bg-orange-100 text-orange-700",
        critical: "bg-rose-100 text-rose-700"
    };

    return map[String(severity || "").toLowerCase()] || "bg-slate-100 text-slate-700";
}

function actionClasses(action) {
    if (action.includes("EMERGENCY")) return "bg-rose-100 text-rose-700";
    if (action.includes("GRANTED")) return "bg-sky-100 text-sky-700";
    if (action.includes("VIEWED")) return "bg-emerald-100 text-emerald-700";
    return "bg-slate-100 text-slate-700";
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

function getTimelineEvents(record) {
    if (Array.isArray(record?.timelineEvents) && record.timelineEvents.length) {
        return record.timelineEvents;
    }

    if (Array.isArray(record?.aiSummary?.timelineEvents) && record.aiSummary.timelineEvents.length) {
        return record.aiSummary.timelineEvents;
    }

    if (Array.isArray(record?.aiSummary?.timeline)) {
        return record.aiSummary.timeline;
    }

    return [];
}

function formatTimelineFinding(event) {
    if (event.finding && event.risk) {
        return `${event.finding} (${event.risk})`;
    }

    if (event.finding) {
        return event.finding;
    }

    if (event.event) {
        return event.event;
    }

    return "Clinical event recorded";
}

function StatCard({ label, value, hint }) {
    return (
        <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
            <p className="mt-2 text-sm text-slate-500">{hint}</p>
        </div>
    );
}

function SectionShell({ title, eyebrow, children, action }) {
    return (
        <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-lg shadow-slate-200/60">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-600">{eyebrow}</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h2>
                </div>
                {action}
            </div>
            <div className="mt-6">{children}</div>
        </section>
    );
}

export default function PatientDashboardPage() {
    const {
        address: patientAddress,
        authError,
        connectWallet,
        hasMetaMask,
        installUrl,
        isAuthenticated,
        isConnecting
    } = useAuth();
    const [records, setRecords] = useState([]);
    const [consentLogs, setConsentLogs] = useState([]);
    const [accessAnalytics, setAccessAnalytics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState("");

    useEffect(() => {
        if (!patientAddress) {
            setRecords([]);
            setConsentLogs([]);
            setAccessAnalytics([]);
            setLoading(false);
            setDashboardError("");
            return;
        }

        let active = true;
        setLoading(true);
        setDashboardError("");

        async function loadDashboard() {
            try {
                const [recordsRes, logsRes, analyticsRes] = await Promise.all([
                    fetch(`${API_BASE}/records/patient/${patientAddress}`, {
                        headers: {
                            "x-wallet-address": patientAddress
                        }
                    }),
                    fetch(`${API_BASE}/patients/${patientAddress}/logs`, {
                        headers: {
                            "x-wallet-address": patientAddress
                        }
                    }),
                    fetch(`${API_BASE}/patients/access-analytics`, {
                        headers: {
                            "x-wallet-address": patientAddress
                        }
                    })
                ]);

                if (!active) return;

                const recordsPayload = await recordsRes.json();
                const logsPayload = await logsRes.json();
                const analyticsPayload = await analyticsRes.json();

                if (!recordsRes.ok) {
                    throw new Error(recordsPayload.message || "Unable to load medical records");
                }

                if (!logsRes.ok) {
                    throw new Error(logsPayload.message || "Unable to load consent logs");
                }

                if (!analyticsRes.ok) {
                    throw new Error(analyticsPayload.message || "Unable to load access analytics");
                }

                setRecords(Array.isArray(recordsPayload?.data) ? recordsPayload.data : []);
                setConsentLogs(Array.isArray(logsPayload?.data) ? logsPayload.data : []);
                setAccessAnalytics(Array.isArray(analyticsPayload?.data) ? analyticsPayload.data : []);
            } catch (error) {
                console.error("Unable to load patient dashboard", error);
                if (active) {
                    setRecords([]);
                    setConsentLogs([]);
                    setAccessAnalytics([]);
                    setDashboardError(error.message || "Unable to load dashboard data");
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        loadDashboard();
        return () => {
            active = false;
        };
    }, [patientAddress]);

    const metrics = useMemo(() => {
        const totalRiskFlags = records.reduce(
            (count, record) => count + (record.aiSummary?.riskFlags?.length || 0),
            0
        );

        const timelineEvents = records.flatMap((record) => getTimelineEvents(record));
        const criticalFlags = records.flatMap((record) => record.aiSummary?.riskFlags || []).filter((flag) =>
            ["critical", "high"].includes(String(flag.severity || "").toLowerCase())
        );

        return {
            totalRecords: records.length,
            riskSignals: totalRiskFlags,
            criticalFlags: criticalFlags.length,
            timelineEvents: timelineEvents.length,
            doctorAccessors: accessAnalytics.length
        };
    }, [accessAnalytics.length, records]);

    const combinedTimeline = useMemo(
        () =>
            records
                .flatMap((record) =>
                    getTimelineEvents(record).map((event) => ({
                        ...event,
                        source: record.title || record.fileName || `Record #${record.recordId}`
                    }))
                )
                .sort((a, b) => {
                    if (a.date === "Unknown") return 1;
                    if (b.date === "Unknown") return -1;
                    return new Date(a.date) - new Date(b.date);
                }),
        [records]
    );

    async function handleConnectWallet() {
        try {
            await connectWallet();
        } catch (error) {
            console.error("Unable to connect MetaMask", error);
        }
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_30%),linear-gradient(180deg,_#f8fffe_0%,_#eef6ff_54%,_#fffaf1_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl">
                {!isAuthenticated ? (
                    <div className="mb-8 rounded-[2rem] border border-teal-200 bg-white/90 p-6 shadow-lg shadow-slate-200/50">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-700">Wallet Authentication</p>
                        <h2 className="mt-3 text-3xl font-semibold text-slate-900">Connect MetaMask to open your patient dashboard.</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                            Your authenticated wallet address is used as the patient identity for records, consent logs, and access history.
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

                {dashboardError ? (
                    <div className="mb-8 rounded-[2rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        {dashboardError}
                    </div>
                ) : null}

                <div className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl shadow-slate-300/40">
                    <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.3fr_0.7fr] md:px-10">
                        <div>
                            <p className="text-sm uppercase tracking-[0.35em] text-teal-300">Patient Control Center</p>
                            <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight md:text-5xl">
                                Own your records, consent windows, and AI-ready medical history.
                            </h1>
                            <p className="mt-4 max-w-2xl text-base text-slate-300">
                                Review encrypted uploads, see who accessed them, and monitor AI-generated summaries and timeline events from one place.
                            </p>
                            <div className="mt-6 flex flex-wrap gap-3">
                                <Link href="/upload" className="rounded-full bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-300">
                                    Upload Record
                                </Link>
                                <Link href="/grant-access" className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5">
                                    Manage Access
                                </Link>
                            </div>
                        </div>
                        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                            <p className="text-sm text-slate-300">Connected patient wallet</p>
                            <p className="mt-2 break-all text-lg font-medium">
                                {patientAddress || "Connect MetaMask to authenticate"}
                            </p>
                            <div className="mt-6 grid gap-3">
                                <div className="rounded-2xl bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Access posture</p>
                                    <p className="mt-2 text-2xl font-semibold">{consentLogs.length}</p>
                                    <p className="mt-1 text-sm text-slate-300">Consent and access actions recorded for this wallet.</p>
                                </div>
                                <div className="rounded-2xl bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Latest audit event</p>
                                    <p className="mt-2 text-sm text-white">{formatDate(consentLogs[0]?.timestamp || Date.now())}</p>
                                    <p className="mt-1 text-sm text-slate-300">{formatLogDetails(consentLogs[0]?.details) || "No audit activity yet"}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Encrypted Records" value={metrics.totalRecords} hint="Stored in IPFS with on-chain reference hashes." />
                    <StatCard label="Risk Signals" value={metrics.riskSignals} hint="AI-generated clinical flags across recent reports." />
                    <StatCard label="High-Priority Flags" value={metrics.criticalFlags} hint="Items that may need prompt care coordination." />
                    <StatCard label="Doctors Accessing Records" value={metrics.doctorAccessors} hint="Doctors who have opened your medical records." />
                </div>

                <div className="mt-8 grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
                    <SectionShell
                        title="Medical Records"
                        eyebrow="Encrypted Storage"
                        action={<span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">{loading ? "Syncing..." : `${records.length} records loaded`}</span>}
                    >
                        <div className="grid gap-4">
                            {records.length ? (
                                records.map((record) => (
                                    <article key={record.recordId} className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-xl font-semibold text-slate-900">{record.title || `Record #${record.recordId}`}</h3>
                                                    <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                                                        {record.recordType}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm text-slate-500">
                                                    Uploaded {formatDate(record.uploadedAt || record.createdAt)} • IPFS {record.ipfsHash}
                                                </p>
                                                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-700">
                                                    {record.aiSummary?.medicalSummary || "AI summary will appear here after processing."}
                                                </p>
                                            </div>
                                            <div className="min-w-56 rounded-2xl bg-slate-950 p-4 text-white">
                                                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Conditions</p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {(record.aiSummary?.conditionsDetected || []).map((condition) => (
                                                        <span key={condition} className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                                                            {condition}
                                                        </span>
                                                    ))}
                                                </div>
                                                <p className="mt-4 text-xs uppercase tracking-[0.25em] text-slate-400">Risk flags</p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {(record.aiSummary?.riskFlags || []).map((flag) => (
                                                        <span key={`${record.recordId}-${flag.label}`} className={`rounded-full px-3 py-1 text-xs font-semibold ${severityClasses(flag.severity)}`}>
                                                            {flag.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                ))
                            ) : (
                                <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                    Upload a medical report to start building your encrypted record library and clinical timeline.
                                </div>
                            )}
                        </div>
                    </SectionShell>

                    <SectionShell title="Consent Ledger" eyebrow="Immutable Audit Trail">
                        <div className="space-y-4">
                            {consentLogs.map((log) => (
                                <div key={log.id || `${log.action}-${log.timestamp}`} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${actionClasses(log.action)}`}>
                                            {log.action.replaceAll("_", " ")}
                                        </span>
                                        <span className="text-sm text-slate-500">{formatDate(log.timestamp)}</span>
                                    </div>
                                    <p className="mt-3 text-sm font-medium text-slate-900">
                                        {log.doctorAddress ? `Doctor ${log.doctorAddress}` : "Patient initiated action"}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">{formatLogDetails(log.details)}</p>
                                </div>
                            ))}
                        </div>
                    </SectionShell>
                </div>

                <div className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
                    <SectionShell title="Access Analytics" eyebrow="Doctor Activity Summary">
                        <AccessLog analytics={accessAnalytics} />
                    </SectionShell>

                    <SectionShell title="AI Medical Summaries" eyebrow="Clinical Insights">
                        <div className="space-y-4">
                            {records.map((record) => (
                                <div key={`summary-${record.recordId}`} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900">{record.title}</h3>
                                            <p className="mt-1 text-sm text-slate-500">{record.recordType}</p>
                                        </div>
                                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">AI Ready</span>
                                    </div>
                                    <p className="mt-4 text-sm leading-6 text-slate-700">{record.aiSummary?.medicalSummary}</p>
                                </div>
                            ))}
                        </div>
                    </SectionShell>

                    <SectionShell title="Medical Timeline" eyebrow="Chronological Patient History">
                        <div className="relative pl-6">
                            <div className="absolute bottom-0 left-2 top-0 w-px bg-gradient-to-b from-teal-300 via-sky-200 to-amber-200" />
                            <div className="space-y-5">
                                {combinedTimeline.length ? (
                                    combinedTimeline.map((event, index) => (
                                        <div key={`${event.date}-${event.source}-${index}`} className="relative rounded-[1.5rem] border border-slate-200 bg-white p-5">
                                            <div className="absolute left-[-24px] top-6 h-4 w-4 rounded-full border-4 border-white bg-teal-400 shadow" />
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
                                                    {event.date === "Unknown" ? "Date Unknown" : formatDate(event.date)}
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {event.type ? (
                                                        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
                                                            {event.type}
                                                        </span>
                                                    ) : null}
                                                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{event.source}</span>
                                                </div>
                                            </div>
                                            <p className="mt-3 text-sm leading-6 text-slate-700">{formatTimelineFinding(event)}</p>
                                            {event.sourceText ? (
                                                <p className="mt-2 text-xs leading-5 text-slate-500">{event.sourceText}</p>
                                            ) : null}
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                        Structured diagnoses, medications, and test findings will appear here after reports are uploaded and processed.
                                    </div>
                                )}
                            </div>
                        </div>
                    </SectionShell>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-1 xl:grid-cols-1">
                    <StatCard label="Timeline Events" value={metrics.timelineEvents} hint="Structured medical events stored from uploaded reports." />
                </div>
            </div>
        </div>
    );
}
