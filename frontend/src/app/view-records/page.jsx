"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

const initialRecords = [
    {
        recordId: 31,
        patientAddress: "0xPatient001...7f3c",
        patientName: "Anita Rao",
        title: "Cardiology Follow-up Report",
        recordType: "Consultation",
        uploadedAt: "2026-03-09T10:30:00.000Z",
        ipfsHash: "bafybeigdyrztcardio001",
        aiSummary: {
            medicalSummary: "Stable vitals with ongoing cardiac medication management and no new ischemic symptoms.",
            conditionsDetected: ["Hypertension", "Coronary Artery Disease"],
            riskFlags: [{ label: "Cardiac instability", severity: "high" }],
            timeline: [
                { date: "2025-12-04", event: "Patient reported intermittent chest discomfort during outpatient visit." },
                { date: "2026-03-09", event: "Cardiology follow-up documented medication adherence and symptom improvement." }
            ]
        }
    },
    {
        recordId: 37,
        patientAddress: "0xPatient001...7f3c",
        patientName: "Anita Rao",
        title: "Medication Adherence Note",
        recordType: "Prescription",
        uploadedAt: "2026-02-20T08:10:00.000Z",
        ipfsHash: "bafybeigdyrztcardio037",
        aiSummary: {
            medicalSummary: "Medication refill review confirms adherence to antihypertensive and statin therapy.",
            conditionsDetected: ["Hypertension"],
            riskFlags: [{ label: "Hypertensive risk", severity: "medium" }],
            timeline: [
                { date: "2026-02-20", event: "Prescription follow-up confirmed regular medication use and refill counseling." }
            ]
        }
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

function severityStyle(severity) {
    const map = {
        medium: "bg-amber-100 text-amber-700",
        high: "bg-orange-100 text-orange-700",
        critical: "bg-rose-100 text-rose-700"
    };

    return map[String(severity || "").toLowerCase()] || "bg-slate-100 text-slate-700";
}

export default function DoctorPatientRecordPage() {
    const [doctorAddress, setDoctorAddress] = useState("0xDoctor001...4d2a");
    const [patientAddress, setPatientAddress] = useState("0xPatient001...7f3c");
    const [selectedRecordId, setSelectedRecordId] = useState(initialRecords[0].recordId);

    const patientRecords = useMemo(
        () => initialRecords.filter((record) => record.patientAddress === patientAddress),
        [patientAddress]
    );

    const selectedRecord = useMemo(
        () => patientRecords.find((record) => record.recordId === selectedRecordId) || patientRecords[0],
        [patientRecords, selectedRecordId]
    );

    const timeline = useMemo(
        () =>
            patientRecords
                .flatMap((record) =>
                    (record.aiSummary?.timeline || []).map((event) => ({
                        ...event,
                        source: record.title
                    }))
                )
                .sort((a, b) => new Date(a.date) - new Date(b.date)),
        [patientRecords]
    );

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef8ff_52%,_#fff7ec_100%)] px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl">
                <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                        <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white">
                            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">Record Viewer</p>
                            <h1 className="mt-3 text-4xl font-semibold">Review granted patient records.</h1>
                            <p className="mt-4 text-sm leading-6 text-slate-300">
                                Doctors can inspect AI summaries, key conditions, and patient history events only while a consent window remains active.
                            </p>
                            <div className="mt-6 space-y-4">
                                <input
                                    value={doctorAddress}
                                    onChange={(event) => setDoctorAddress(event.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
                                    placeholder="Doctor wallet"
                                />
                                <input
                                    value={patientAddress}
                                    onChange={(event) => setPatientAddress(event.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
                                    placeholder="Patient wallet"
                                />
                                <Link href="/doctor" className="inline-flex rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300">
                                    Back to Dashboard
                                </Link>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Available files</p>
                                <div className="mt-4 space-y-3">
                                    {patientRecords.map((record) => (
                                        <button
                                            key={record.recordId}
                                            type="button"
                                            onClick={() => setSelectedRecordId(record.recordId)}
                                            className={`w-full rounded-[1.25rem] border px-4 py-4 text-left transition ${
                                                selectedRecord?.recordId === record.recordId
                                                    ? "border-sky-300 bg-sky-50"
                                                    : "border-slate-200 bg-white hover:border-slate-300"
                                            }`}
                                        >
                                            <p className="text-sm font-semibold text-slate-900">{record.title}</p>
                                            <p className="mt-1 text-xs text-slate-500">{record.recordType}</p>
                                            <p className="mt-2 text-xs text-slate-500">{formatDate(record.uploadedAt)}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
                                {selectedRecord ? (
                                    <>
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">Selected record</p>
                                                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedRecord.title}</h2>
                                            </div>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                {selectedRecord.recordType}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-sm text-slate-500">
                                            {selectedRecord.patientName} • {selectedRecord.patientAddress}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Uploaded {formatDate(selectedRecord.uploadedAt)} • IPFS {selectedRecord.ipfsHash}
                                        </p>
                                        <div className="mt-6 rounded-[1.5rem] bg-slate-50 p-4">
                                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">AI Summary</p>
                                            <p className="mt-3 text-sm leading-6 text-slate-700">
                                                {selectedRecord.aiSummary?.medicalSummary}
                                            </p>
                                        </div>
                                        <div className="mt-5 flex flex-wrap gap-2">
                                            {(selectedRecord.aiSummary?.conditionsDetected || []).map((condition) => (
                                                <span key={condition} className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
                                                    {condition}
                                                </span>
                                            ))}
                                            {(selectedRecord.aiSummary?.riskFlags || []).map((flag) => (
                                                <span key={flag.label} className={`rounded-full px-3 py-1 text-xs font-semibold ${severityStyle(flag.severity)}`}>
                                                    {flag.label}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                        No records are currently available for this patient address.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
                    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">Patient Snapshot</p>
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                                <p className="text-sm text-slate-500">Patient</p>
                                <p className="mt-2 text-2xl font-semibold text-slate-900">
                                    {selectedRecord?.patientName || "Unknown patient"}
                                </p>
                                <p className="mt-1 text-sm text-slate-500">{patientAddress}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                                <p className="text-sm text-slate-500">Available records</p>
                                <p className="mt-2 text-2xl font-semibold text-slate-900">{patientRecords.length}</p>
                                <p className="mt-1 text-sm text-slate-500">Granted under the current consent window</p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-700">Medical Timeline</p>
                        <div className="mt-5 relative pl-6">
                            <div className="absolute bottom-0 left-2 top-0 w-px bg-gradient-to-b from-sky-300 to-teal-300" />
                            <div className="space-y-4">
                                {timeline.map((event, index) => (
                                    <div key={`${event.date}-${index}`} className="relative rounded-[1.5rem] border border-slate-200 bg-white p-4">
                                        <div className="absolute left-[-24px] top-5 h-4 w-4 rounded-full border-4 border-white bg-sky-400" />
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
                                                {formatDate(event.date)}
                                            </p>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                {event.source}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-sm leading-6 text-slate-700">{event.event}</p>
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
