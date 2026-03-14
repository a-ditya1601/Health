"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AccessLog from "../../components/AccessLog";
import { useAuth } from "../../context/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";
const dateFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
});

function shouldRedirectToAuth(message) {
    const normalized = String(message || "").toLowerCase();
    return (
        normalized.includes("patient is not registered") ||
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

function requestStatusClasses(status) {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "approved") {
        return "bg-emerald-100 text-emerald-700";
    }

    if (normalized === "rejected") {
        return "bg-rose-100 text-rose-700";
    }

    return "bg-amber-100 text-amber-700";
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
    const entry =
        record?.timelineEntry ||
        record?.aiSummary?.timelineEntry ||
        (record?.aiSummary?.finalConclusion
            ? {
                  date: record?.aiSummary?.reportDate || record?.createdAt || null,
                  conclusion: record?.aiSummary?.finalConclusion
              }
            : null);

    if (!entry) {
        return [];
    }

    const conclusion = String(entry.conclusion || record?.aiSummary?.finalConclusion || "").trim();
    const parsedDate = new Date(entry.date || "");
    const fallbackDate = record?.createdAt || record?.uploadedAt || null;
    const resolvedDate =
        entry.date &&
        entry.date !== "Unknown" &&
        !Number.isNaN(parsedDate.getTime())
            ? entry.date
            : fallbackDate;

    if (!conclusion) {
        return [];
    }

    return [
        {
            date: resolvedDate,
            conclusion
        }
    ];
}

function formatTimelineFinding(event) {
    return event?.conclusion || "No significant abnormalities detected.";
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
    const router = useRouter();
    const {
        address: patientAddress,
        isAuthenticated,
        isReady
    } = useAuth();
    const [records, setRecords] = useState([]);
    const [consentLogs, setConsentLogs] = useState([]);
    const [accessRequests, setAccessRequests] = useState([]);
    const [accessAnalytics, setAccessAnalytics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState("");
    const [showAllLogs, setShowAllLogs] = useState(false);
    const [deletingRecordId, setDeletingRecordId] = useState(null);
    const [actingRequestKey, setActingRequestKey] = useState("");
    const [accessKeyState, setAccessKeyState] = useState({
        doctorAddress: "",
        accessKey: ""
    });

    useEffect(() => {
        if (isReady && !isAuthenticated) {
            router.replace("/auth");
        }
    }, [isAuthenticated, isReady, router]);

    useEffect(() => {
        if (!patientAddress) {
            setRecords([]);
            setConsentLogs([]);
            setAccessRequests([]);
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
                const [recordsRes, logsRes, requestsRes, analyticsRes] = await Promise.all([
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
                    fetch(`${API_BASE}/patients/${patientAddress}/access-requests`, {
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
                const requestsPayload = await requestsRes.json();
                const analyticsPayload = await analyticsRes.json();

                if (!recordsRes.ok) {
                    throw new Error(recordsPayload.message || "Unable to load medical records");
                }

                if (!logsRes.ok) {
                    throw new Error(logsPayload.message || "Unable to load consent logs");
                }

                if (!requestsRes.ok) {
                    throw new Error(requestsPayload.message || "Unable to load access requests");
                }

                if (!analyticsRes.ok) {
                    throw new Error(analyticsPayload.message || "Unable to load access analytics");
                }

                setRecords(Array.isArray(recordsPayload?.data) ? recordsPayload.data : []);
                setConsentLogs(Array.isArray(logsPayload?.data) ? logsPayload.data : []);
                setAccessRequests(Array.isArray(requestsPayload?.data) ? requestsPayload.data : []);
                setAccessAnalytics(Array.isArray(analyticsPayload?.data) ? analyticsPayload.data : []);
            } catch (error) {
                console.error("Unable to load patient dashboard", error);
                if (active) {
                    if (shouldRedirectToAuth(error.message)) {
                        router.replace("/auth");
                        return;
                    }
                    setRecords([]);
                    setConsentLogs([]);
                    setAccessRequests([]);
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
    }, [patientAddress, router]);

    async function handleGrantAccessRequest(request) {
        if (!patientAddress) {
            return;
        }

        const requestKey = `${request.requestId || "req"}-${request.doctorAddress}`;
        setDashboardError("");
        setActingRequestKey(requestKey);

        try {
            const response = await fetch(`${API_BASE}/patients/grant-access`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-address": patientAddress
                },
                body: JSON.stringify({
                    patientAddress,
                    doctorAddress: request.doctorAddress,
                    duration: 86400,
                    reason: request.reason || "Patient approved doctor request"
                })
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.message || "Unable to grant doctor access");
            }

            setAccessRequests((current) =>
                current.map((item) =>
                    item.doctorAddress === request.doctorAddress && item.status === "pending"
                        ? {
                              ...item,
                              status: "approved",
                              respondedAt: new Date().toISOString()
                          }
                        : item
                )
            );

            setAccessKeyState({
                doctorAddress: request.doctorAddress,
                accessKey: payload?.data?.accessKey || ""
            });
        } catch (error) {
            setDashboardError(error.message || "Unable to grant doctor access");
        } finally {
            setActingRequestKey("");
        }
    }

    async function handleRejectAccessRequest(request) {
        if (!patientAddress) {
            return;
        }

        const requestKey = `${request.requestId || "req"}-${request.doctorAddress}`;
        setDashboardError("");
        setActingRequestKey(requestKey);

        try {
            const response = await fetch(`${API_BASE}/patients/reject-access`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-address": patientAddress
                },
                body: JSON.stringify({
                    patientAddress,
                    doctorAddress: request.doctorAddress,
                    reason: "Patient rejected this access request"
                })
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.message || "Unable to reject access request");
            }

            setAccessRequests((current) =>
                current.map((item) =>
                    item.doctorAddress === request.doctorAddress && item.status === "pending"
                        ? {
                              ...item,
                              status: "rejected",
                              respondedAt: payload?.data?.respondedAt || new Date().toISOString()
                          }
                        : item
                )
            );
        } catch (error) {
            setDashboardError(error.message || "Unable to reject access request");
        } finally {
            setActingRequestKey("");
        }
    }

    async function handleDeleteRecord(recordId) {
        if (!patientAddress) {
            return;
        }

        const shouldDelete = window.confirm("Delete this uploaded report from your dashboard?");

        if (!shouldDelete) {
            return;
        }

        setDashboardError("");
        setDeletingRecordId(recordId);

        try {
            const response = await fetch(`${API_BASE}/records/${recordId}`, {
                method: "DELETE",
                headers: {
                    "x-wallet-address": patientAddress
                }
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.message || "Unable to delete medical record");
            }

            setRecords((current) => current.filter((record) => record.recordId !== recordId));
        } catch (error) {
            setDashboardError(error.message || "Unable to delete medical record");
        } finally {
            setDeletingRecordId(null);
        }
    }

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
                    if (!a.date) return 1;
                    if (!b.date) return -1;
                    return new Date(a.date) - new Date(b.date);
                }),
        [records]
    );

    const pendingAccessRequests = useMemo(
        () => accessRequests.filter((request) => String(request.status || "pending").toLowerCase() === "pending"),
        [accessRequests]
    );

    const approvedDoctors = useMemo(() => {
        const approvedMap = new Map();

        for (const request of accessRequests) {
            if (String(request.status || "").toLowerCase() !== "approved") {
                continue;
            }

            approvedMap.set(request.doctorAddress, {
                doctorAddress: request.doctorAddress,
                approvedAt: request.respondedAt || request.createdAt,
                reason: request.reason || "Patient approved access request"
            });
        }

        for (const log of consentLogs) {
            if (String(log.action || "").toUpperCase() !== "ACCESS_GRANTED" || !log.doctorAddress) {
                continue;
            }

            if (!approvedMap.has(log.doctorAddress)) {
                approvedMap.set(log.doctorAddress, {
                    doctorAddress: log.doctorAddress,
                    approvedAt: log.timestamp,
                    reason: log.details?.reason || "Doctor access granted"
                });
            }
        }

        return Array.from(approvedMap.values()).sort((a, b) => new Date(b.approvedAt) - new Date(a.approvedAt));
    }, [accessRequests, consentLogs]);

    const sortedConsentLogs = useMemo(
        () => [...consentLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
        [consentLogs]
    );

    const displayedConsentLogs = useMemo(
        () => (showAllLogs ? sortedConsentLogs : sortedConsentLogs.slice(0, 5)),
        [showAllLogs, sortedConsentLogs]
    );

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_30%),linear-gradient(180deg,_#f8fffe_0%,_#eef6ff_54%,_#fffaf1_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl">
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

                <SectionShell title="Doctor Access Requests" eyebrow="Patient Consent Queue">
                    {accessKeyState.accessKey ? (
                        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                            <p className="text-sm font-semibold">Share this key with the doctor</p>
                            <p className="mt-2 text-xs text-emerald-700">Doctor: {accessKeyState.doctorAddress}</p>
                            <p className="mt-3 rounded-xl border border-emerald-300 bg-white px-3 py-2 font-mono text-base tracking-[0.08em]">
                                {accessKeyState.accessKey}
                            </p>
                        </div>
                    ) : null}

                    <div className="grid gap-4">
                        {pendingAccessRequests.length ? (
                            pendingAccessRequests.map((request) => {
                                const requestKey = `${request.requestId || "req"}-${request.doctorAddress}`;
                                const isActing = actingRequestKey === requestKey;

                                return (
                                    <article key={requestKey} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-slate-900">Doctor: {request.doctorAddress}</p>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${requestStatusClasses(request.status)}`}>
                                                {request.status || "pending"}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm text-slate-600">Requested: {formatDate(request.createdAt)}</p>
                                        <p className="mt-1 text-sm text-slate-600">Reason: {request.reason || "No reason provided"}</p>

                                        <div className="mt-4 flex flex-wrap gap-3">
                                            <button
                                                type="button"
                                                onClick={() => handleGrantAccessRequest(request)}
                                                disabled={isActing}
                                                className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {isActing ? "Processing..." : "Grant Access"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRejectAccessRequest(request)}
                                                disabled={isActing}
                                                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </article>
                                );
                            })
                        ) : (
                            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                No pending doctor access requests.
                            </div>
                        )}
                    </div>
                </SectionShell>

                <SectionShell title="Approved Doctors" eyebrow="Consent Status">
                    <div className="grid gap-4">
                        {approvedDoctors.length ? (
                            approvedDoctors.map((doctor) => (
                                <article key={`${doctor.doctorAddress}-${doctor.approvedAt}`} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-sm font-semibold text-slate-900">Doctor: {doctor.doctorAddress}</p>
                                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                                            Approved
                                        </span>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-600">Approved: {formatDate(doctor.approvedAt)}</p>
                                    <p className="mt-1 text-sm text-slate-600">Reason: {doctor.reason}</p>
                                </article>
                            ))
                        ) : (
                            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                No approved doctors yet.
                            </div>
                        )}
                    </div>
                </SectionShell>

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
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteRecord(record.recordId)}
                                                        disabled={deletingRecordId === record.recordId}
                                                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        {deletingRecordId === record.recordId ? "Deleting..." : "Delete"}
                                                    </button>
                                                </div>
                                                <p className="mt-2 text-sm text-slate-500">
                                                    Uploaded {formatDate(record.uploadedAt || record.createdAt)} • IPFS {record.ipfsHash}
                                                </p>
                                                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-700">
                                                    {record.aiSummary?.clinicalSummary || "No significant health threats or abnormalities detected in the report."}
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
                                    No medical records uploaded yet.
                                </div>
                            )}
                        </div>
                    </SectionShell>

                    <SectionShell title="Consent Ledger" eyebrow="Immutable Audit Trail">
                        <div className="space-y-4">
                            {displayedConsentLogs.map((log) => (
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

                            {sortedConsentLogs.length > 5 ? (
                                <button
                                    type="button"
                                    onClick={() => setShowAllLogs((current) => !current)}
                                    className="mt-4 text-sm font-medium text-sky-700 transition hover:underline"
                                >
                                    {showAllLogs ? "Show Less" : "View All Logs"}
                                </button>
                            ) : null}
                        </div>
                    </SectionShell>
                </div>

                <div className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
                    <SectionShell title="Access Analytics" eyebrow="Doctor Activity Summary">
                        <AccessLog analytics={accessAnalytics} />
                    </SectionShell>

                    <SectionShell title="AI Medical Summaries" eyebrow="Clinical Insights">
                        <div className="space-y-4">
                            {records.length ? (
                                records.map((record) => (
                                    <div key={`summary-${record.recordId}`} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-900">{record.title}</h3>
                                                <p className="mt-1 text-sm text-slate-500">{record.recordType}</p>
                                            </div>
                                            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">AI Ready</span>
                                        </div>

                                        <div className="mt-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Conditions Detected</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {(record.aiSummary?.conditionsDetected || record.aiSummary?.conditions || []).length ? (
                                                    (record.aiSummary?.conditionsDetected || record.aiSummary?.conditions || []).map((condition) => (
                                                        <span key={`${record.recordId}-${condition}`} className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
                                                            {condition}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-sm text-slate-500">No major abnormalities detected in the report.</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Clinical Summary</p>
                                            <p className="mt-2 text-sm leading-6 text-slate-700">
                                                {record.aiSummary?.clinicalSummary || "No major abnormalities detected in the report."}
                                            </p>
                                        </div>

                                        <div className="mt-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Significant Abnormalities</p>
                                            <ul className="mt-2 space-y-1 text-sm text-slate-700">
                                                {(record.aiSummary?.significantAbnormalities || record.aiSummary?.abnormalFindings || []).length ? (
                                                    (record.aiSummary?.significantAbnormalities || record.aiSummary?.abnormalFindings || []).map((finding) => (
                                                        <li key={`${record.recordId}-${finding}`}>- {finding}</li>
                                                    ))
                                                ) : (
                                                    <li>No major abnormalities detected in the report.</li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                    No medical records uploaded yet.
                                </div>
                            )}
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
                                                    {event.date ? formatDate(event.date) : "Date Unknown"}
                                                </p>
                                            </div>
                                            <p className="mt-3 text-sm leading-6 text-slate-700">{formatTimelineFinding(event)}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                        No medical timeline available yet.
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
