"use client";

import React, { useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

const initialRequests = [
    {
        id: 1,
        patientAddress: "0xPatient002...8c1d",
        urgency: "critical",
        reason: "Patient arrived with dizziness, hypotension, and unclear medication history.",
        requestedAt: "2026-03-11T07:45:00.000Z",
        status: "pending"
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

function urgencyBadge(level) {
    const map = {
        medium: "bg-amber-100 text-amber-700",
        high: "bg-orange-100 text-orange-700",
        critical: "bg-rose-100 text-rose-700"
    };

    return map[level] || "bg-slate-100 text-slate-700";
}

export default function EmergencyRequestPage() {
    const [doctorAddress, setDoctorAddress] = useState("0xDoctor001...4d2a");
    const [patientAddress, setPatientAddress] = useState("");
    const [reason, setReason] = useState("");
    const [urgency, setUrgency] = useState("critical");
    const [durationInHours, setDurationInHours] = useState("6");
    const [contactChannel, setContactChannel] = useState("On-call hospital pager");
    const [requests, setRequests] = useState(initialRequests);
    const [message, setMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setMessage("");
        setErrorMessage("");
        setIsSubmitting(true);

        const payload = {
            patientAddress,
            doctorAddress,
            reason: `${reason} Contact: ${contactChannel}. Requested duration: ${durationInHours} hours.`
        };

        try {
            const response = await fetch(`${API_BASE}/doctors/access/emergency/request`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(result?.message || "Unable to submit emergency access request.");
            }

            const request = result?.data || {};
            setRequests((current) => [
                {
                    id: request.requestId || Date.now(),
                    patientAddress: request.patientAddress || patientAddress,
                    urgency,
                    reason,
                    requestedAt: request.requestedAt || new Date().toISOString(),
                    status: request.status || "pending"
                },
                ...current
            ]);
            setMessage(result?.message || "Emergency access request submitted and ready for patient approval or protocol escalation.");
            setPatientAddress("");
            setReason("");
            setUrgency("critical");
            setDurationInHours("6");
        } catch (error) {
            console.error("Emergency access request failed", error);
            setErrorMessage(error.message || "Unable to submit emergency access request.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-[linear-gradient(165deg,_#fff6f5_0%,_#fffdf9_38%,_#f3faff_100%)] px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl">
                <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
                    <section className="rounded-[2rem] border border-rose-200 bg-slate-950 p-6 text-white shadow-2xl shadow-slate-300/30">
                        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-rose-300">Emergency Protocol</p>
                        <h1 className="mt-3 text-4xl font-semibold">Request time-limited emergency access.</h1>
                        <p className="mt-4 text-sm leading-6 text-slate-300">
                            Use this flow only when urgent care requires immediate patient history. Emergency requests are logged for later consent review and audit compliance.
                        </p>

                        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                            <input
                                value={doctorAddress}
                                onChange={(event) => setDoctorAddress(event.target.value)}
                                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
                                placeholder="Doctor wallet address"
                            />
                            <input
                                value={patientAddress}
                                onChange={(event) => setPatientAddress(event.target.value)}
                                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
                                placeholder="Patient wallet address"
                                required
                            />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <select
                                    value={urgency}
                                    onChange={(event) => setUrgency(event.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none"
                                >
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="critical">Critical</option>
                                </select>
                                <input
                                    type="number"
                                    min="1"
                                    max="24"
                                    value={durationInHours}
                                    onChange={(event) => setDurationInHours(event.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
                                    placeholder="Hours requested"
                                />
                            </div>
                            <input
                                value={contactChannel}
                                onChange={(event) => setContactChannel(event.target.value)}
                                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
                                placeholder="Callback or escalation channel"
                            />
                            <textarea
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                rows={5}
                                className="w-full rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
                                placeholder="Describe the emergency, current symptoms, and why patient records are needed"
                                required
                            />
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="rounded-full bg-rose-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? "Submitting..." : "Submit Emergency Request"}
                            </button>
                        </form>
                    </section>

                    <section className="space-y-6">
                        {message ? (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                {message}
                            </div>
                        ) : null}
                        {errorMessage ? (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                                {errorMessage}
                            </div>
                        ) : null}

                        <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">Emergency Checklist</p>
                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                                    <p className="text-sm font-medium text-slate-900">Before requesting</p>
                                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                                        <li>Confirm the case meets emergency access policy.</li>
                                        <li>State the clinical reason and expected duration clearly.</li>
                                        <li>Provide a hospital callback or escalation contact.</li>
                                    </ul>
                                </div>
                                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                                    <p className="text-sm font-medium text-slate-900">After approval</p>
                                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                                        <li>Review only the minimum necessary records.</li>
                                        <li>Document the care event in your system of record.</li>
                                        <li>Expect the access window to expire automatically.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-700">Recent Requests</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">Emergency access history</h2>
                                </div>
                                <Link href="/doctor" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                                    Back to Dashboard
                                </Link>
                            </div>

                            <div className="mt-6 space-y-4">
                                {requests.map((request) => (
                                    <article key={request.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${urgencyBadge(request.urgency)}`}>
                                                {request.urgency}
                                            </span>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                {request.status}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-sm font-medium text-slate-900">{request.patientAddress}</p>
                                        <p className="mt-2 text-sm leading-6 text-slate-600">{request.reason}</p>
                                        <p className="mt-3 text-sm text-slate-500">{formatDate(request.requestedAt)}</p>
                                    </article>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
