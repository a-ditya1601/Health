"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

const initialDoctors = [
    {
        doctorAddress: "0xDrA1...98f2",
        name: "Dr. Riya Mehta",
        specialty: "Cardiology",
        expiresAt: "2026-03-12T11:45:00.000Z",
        status: "active",
        reason: "Post-visit follow-up"
    },
    {
        doctorAddress: "0xER24...ab19",
        name: "Dr. Arjun Singh",
        specialty: "Emergency Medicine",
        expiresAt: "2026-03-11T23:59:00.000Z",
        status: "emergency",
        reason: "Emergency access for acute evaluation"
    }
];

const initialLogs = [
    {
        id: 1,
        action: "ACCESS_GRANTED",
        doctorAddress: "0xDrA1...98f2",
        details: "48-hour review window approved",
        timestamp: "2026-03-10T11:45:00.000Z"
    },
    {
        id: 2,
        action: "ACCESS_REVOKED",
        doctorAddress: "0xDrP0...8bd1",
        details: "Neurology access window manually ended",
        timestamp: "2026-03-04T09:20:00.000Z"
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

function badgeForStatus(status) {
    const map = {
        active: "bg-emerald-100 text-emerald-700",
        emergency: "bg-rose-100 text-rose-700",
        revoked: "bg-slate-200 text-slate-700"
    };

    return map[status] || "bg-slate-100 text-slate-700";
}

export default function PatientAccessControlPage() {
    const { address: authenticatedPatientAddress } = useAuth();
    const [patientAddress, setPatientAddress] = useState("");
    const [doctorAddress, setDoctorAddress] = useState("");
    const [doctorName, setDoctorName] = useState("");
    const [specialty, setSpecialty] = useState("General Practice");
    const [durationInSeconds, setDurationInSeconds] = useState("86400");
    const [reason, setReason] = useState("Routine clinical review");
    const [accessList, setAccessList] = useState(initialDoctors);
    const [logs, setLogs] = useState(initialLogs);
    const [notice, setNotice] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeDoctorAddress, setActiveDoctorAddress] = useState("");

    useEffect(() => {
        setPatientAddress(authenticatedPatientAddress || "");
    }, [authenticatedPatientAddress]);

    const metrics = useMemo(() => {
        const active = accessList.filter((item) => item.status === "active").length;
        const emergency = accessList.filter((item) => item.status === "emergency").length;

        return {
            totalDoctors: accessList.length,
            active,
            emergency
        };
    }, [accessList]);

    async function handleGrantAccess(event) {
        event.preventDefault();
        setNotice("");
        setErrorMessage("");
        setIsSubmitting(true);

        const payload = {
            patientAddress,
            doctorAddress,
            durationInSeconds: Number(durationInSeconds),
            reason
        };

        try {
            const response = await fetch(`${API_BASE}/patients/access/grant`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-address": patientAddress
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(result?.message || "Unable to grant doctor access.");
            }

            const permission = result?.data || {};
            const newEntry = {
                doctorAddress,
                name: doctorName || "Doctor",
                specialty,
                expiresAt:
                    permission.expiresAt ||
                    new Date(Date.now() + Number(durationInSeconds) * 1000).toISOString(),
                status: "active",
                reason
            };

            setAccessList((current) => [newEntry, ...current]);
            setLogs((current) => [
                {
                    id: Date.now(),
                    action: "ACCESS_GRANTED",
                    doctorAddress,
                    details: `${reason} for ${Math.round(Number(durationInSeconds) / 3600)} hours`,
                    timestamp: new Date().toISOString()
                },
                ...current
            ]);
            setNotice(result?.message || "Doctor access granted and consent event logged.");
            setDoctorAddress("");
            setDoctorName("");
            setReason("Routine clinical review");
        } catch (error) {
            console.error("Grant doctor access failed", error);
            setErrorMessage(error.message || "Unable to grant doctor access.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleRevokeAccess(doctor) {
        setNotice("");
        setErrorMessage("");
        setActiveDoctorAddress(doctor.doctorAddress);

        try {
            const response = await fetch(`${API_BASE}/patients/access/revoke`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-address": patientAddress
                },
                body: JSON.stringify({
                    patientAddress,
                    doctorAddress: doctor.doctorAddress
                })
            });
            const result = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(result?.message || "Unable to revoke doctor access.");
            }

            setAccessList((current) =>
                current.map((item) =>
                    item.doctorAddress === doctor.doctorAddress ? { ...item, status: "revoked" } : item
                )
            );
            setLogs((current) => [
                {
                    id: Date.now(),
                    action: "ACCESS_REVOKED",
                    doctorAddress: doctor.doctorAddress,
                    details: `Consent window revoked for ${doctor.name}`,
                    timestamp: new Date().toISOString()
                },
                ...current
            ]);
            setNotice(result?.message || "Access revoked and logged on the consent timeline.");
        } catch (error) {
            console.error("Revoke access failed", error);
            setErrorMessage(error.message || "Unable to revoke doctor access.");
        } finally {
            setActiveDoctorAddress("");
        }
    }

    return (
        <div className="min-h-screen bg-[linear-gradient(145deg,_#f4fbff_0%,_#ffffff_45%,_#fff6ea_100%)] px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl">
                <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
                    <section className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-2xl shadow-slate-300/30">
                        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-teal-300">Consent Manager</p>
                        <h1 className="mt-3 text-4xl font-semibold">Grant, revoke, and audit doctor access.</h1>
                        <p className="mt-4 text-sm leading-6 text-slate-300">
                            Patients control temporary access windows. Every permission change becomes an auditable event for compliance and consent tracking.
                        </p>

                        <div className="mt-6 grid gap-4 sm:grid-cols-3">
                            <div className="rounded-[1.5rem] bg-white/5 p-4">
                                <p className="text-sm text-slate-400">Doctors listed</p>
                                <p className="mt-2 text-3xl font-semibold">{metrics.totalDoctors}</p>
                            </div>
                            <div className="rounded-[1.5rem] bg-white/5 p-4">
                                <p className="text-sm text-slate-400">Active approvals</p>
                                <p className="mt-2 text-3xl font-semibold">{metrics.active}</p>
                            </div>
                            <div className="rounded-[1.5rem] bg-white/5 p-4">
                                <p className="text-sm text-slate-400">Emergency sessions</p>
                                <p className="mt-2 text-3xl font-semibold">{metrics.emergency}</p>
                            </div>
                        </div>

                        <form onSubmit={handleGrantAccess} className="mt-8 space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                            <h2 className="text-xl font-semibold">Grant doctor access</h2>
                            <input
                                value={patientAddress}
                                onChange={(event) => setPatientAddress(event.target.value)}
                                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none"
                                placeholder="Patient wallet address"
                            />
                            <input
                                value={doctorAddress}
                                onChange={(event) => setDoctorAddress(event.target.value)}
                                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none"
                                placeholder="Doctor wallet address"
                                required
                            />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <input
                                    value={doctorName}
                                    onChange={(event) => setDoctorName(event.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none"
                                    placeholder="Doctor name"
                                />
                                <input
                                    value={specialty}
                                    onChange={(event) => setSpecialty(event.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none"
                                    placeholder="Specialty"
                                />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <input
                                    type="number"
                                    min="3600"
                                    step="3600"
                                    value={durationInSeconds}
                                    onChange={(event) => setDurationInSeconds(event.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none"
                                    placeholder="Duration in seconds"
                                />
                                <input
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none"
                                    placeholder="Reason"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="rounded-full bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? "Granting Access..." : "Grant Access Window"}
                            </button>
                        </form>
                    </section>

                    <section className="space-y-6">
                        {notice ? (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                {notice}
                            </div>
                        ) : null}
                        {errorMessage ? (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                                {errorMessage}
                            </div>
                        ) : null}

                        <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Doctor Access Windows</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">Current permissions</h2>
                                </div>
                                <Link href="/patient" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                                    View Dashboard
                                </Link>
                            </div>

                            <div className="mt-6 grid gap-4">
                                {accessList.map((doctor) => (
                                    <article key={`${doctor.doctorAddress}-${doctor.expiresAt}`} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <h3 className="text-xl font-semibold text-slate-900">{doctor.name}</h3>
                                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeForStatus(doctor.status)}`}>
                                                        {doctor.status}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm text-slate-500">
                                                    {doctor.specialty} • {doctor.doctorAddress}
                                                </p>
                                                <p className="mt-3 text-sm leading-6 text-slate-700">{doctor.reason}</p>
                                                <p className="mt-2 text-sm text-slate-500">Expires {formatDate(doctor.expiresAt)}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRevokeAccess(doctor)}
                                                disabled={doctor.status === "revoked" || activeDoctorAddress === doctor.doctorAddress}
                                                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {doctor.status === "revoked"
                                                    ? "Access Revoked"
                                                    : activeDoctorAddress === doctor.doctorAddress
                                                        ? "Revoking..."
                                                        : "Revoke Access"}
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">Consent Logs</p>
                            <div className="mt-5 space-y-4">
                                {logs.map((log) => (
                                    <div key={log.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                {log.action.replaceAll("_", " ")}
                                            </span>
                                            <span className="text-sm text-slate-500">{formatDate(log.timestamp)}</span>
                                        </div>
                                        <p className="mt-3 text-sm font-medium text-slate-900">{log.doctorAddress}</p>
                                        <p className="mt-1 text-sm text-slate-600">{log.details}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
