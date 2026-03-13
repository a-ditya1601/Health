"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

function StepPill({ label, active }) {
    return (
        <div className={`rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-teal-500 text-white" : "bg-white text-slate-500"}`}>
            {label}
        </div>
    );
}

export default function PatientUploadPage() {
    const {
        address: patientAddress,
        authError,
        connectWallet,
        hasMetaMask,
        installUrl,
        isAuthenticated,
        isConnecting
    } = useAuth();
    const [recordType, setRecordType] = useState("Lab Report");
    const [metadata, setMetadata] = useState("Annual metabolic panel and physician note.");
    const [file, setFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [error, setError] = useState("");

    const stages = useMemo(
        () => [
            "Select medical PDF",
            "Encrypt before upload",
            "Pin encrypted file to IPFS",
            "Save hash on-chain",
            "Generate AI summary"
        ],
        []
    );

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setUploadResult(null);

        if (!patientAddress) {
            setError("Connect MetaMask before uploading a medical record.");
            return;
        }

        if (!file) {
            setError("Please attach a PDF report before uploading.");
            return;
        }

        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append("patientAddress", patientAddress);
            formData.append("recordType", recordType);
            formData.append("metadata", metadata);
            formData.append("file", file);

            const response = await fetch(`${API_BASE}/records/upload`, {
                method: "POST",
                headers: {
                    "x-wallet-address": patientAddress
                },
                body: formData
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(payload?.message || "Upload failed.");
            }

            setUploadResult(payload.data);
        } catch (submitError) {
            setUploadResult({
                record: {
                    recordId: Date.now(),
                    recordType,
                    fileName: file.name,
                    ipfsHash: "mock-bafy-upload-preview-001",
                    txHash: "0xmockhashuploaded",
                    createdAt: new Date().toISOString()
                },
                storage: {
                    provider: "mock-ipfs",
                    gatewayUrl: "https://gateway.pinata.cloud/ipfs/mock-bafy-upload-preview-001"
                },
                encryption: {
                    algorithm: "aes-256-gcm",
                    keyHash: "mock-key-hash-preview"
                },
                aiSummary: {
                    medicalSummary:
                        "Preview summary: uploaded file will be encrypted, pinned to IPFS, and summarized for conditions and risk flags.",
                    riskFlags: [{ label: "Pending AI review", severity: "medium" }],
                    conditionsDetected: ["Awaiting extraction"],
                    timeline: [{ date: new Date().toISOString(), event: "Upload queued for timeline extraction." }]
                }
            });
            setError(`${submitError.message} Showing a local preview response instead.`);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleConnectWallet() {
        try {
            await connectWallet();
        } catch (error) {
            console.error("Unable to connect MetaMask", error);
        }
    }

    return (
        <div className="min-h-screen bg-[linear-gradient(160deg,_#f6fffb_0%,_#edf7ff_50%,_#fff7ec_100%)] px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[1.05fr_0.95fr]">
                <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-slate-200/60 backdrop-blur">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-600">Patient Upload Flow</p>
                    <h1 className="mt-3 text-4xl font-semibold text-slate-900">Upload and protect a new medical record.</h1>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
                        Files stay off-chain. This flow encrypts the report, uploads it to IPFS, stores only the hash on Polygon, and prepares AI summaries for the patient timeline.
                    </p>

                    {!isAuthenticated ? (
                        <div className="mt-6 rounded-[1.5rem] border border-teal-200 bg-teal-50 p-4">
                            <p className="text-sm font-medium text-slate-900">
                                Connect MetaMask before uploading.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={handleConnectWallet}
                                    disabled={!hasMetaMask || isConnecting}
                                    className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isConnecting ? "Connecting..." : "Connect MetaMask"}
                                </button>
                                {!hasMetaMask ? (
                                    <a
                                        href={installUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
                                    >
                                        Install MetaMask
                                    </a>
                                ) : null}
                            </div>
                            {authError ? (
                                <p className="mt-3 text-sm text-rose-700">{authError}</p>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="mt-6 flex flex-wrap gap-3">
                        {stages.map((stage, index) => (
                            <StepPill key={stage} label={`${index + 1}. ${stage}`} active={Boolean(file) || index === 0} />
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                        <div className="grid gap-5 md:grid-cols-2">
                            <label className="block">
                                <span className="mb-2 block text-sm font-medium text-slate-700">Patient wallet</span>
                                <input
                                    value={patientAddress}
                                    readOnly
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white"
                                    placeholder="Connect MetaMask to use your wallet"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-2 block text-sm font-medium text-slate-700">Record type</span>
                                <select
                                    value={recordType}
                                    onChange={(event) => setRecordType(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white"
                                >
                                    <option>Lab Report</option>
                                    <option>Consultation</option>
                                    <option>Discharge Summary</option>
                                    <option>Imaging</option>
                                    <option>Prescription</option>
                                </select>
                            </label>
                        </div>

                        <label className="block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">Clinical note for the upload</span>
                            <textarea
                                value={metadata}
                                onChange={(event) => setMetadata(event.target.value)}
                                rows={4}
                                className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white"
                                placeholder="Add context for the record..."
                            />
                        </label>

                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-teal-300 bg-teal-50/60 px-6 py-10 text-center transition hover:border-teal-400 hover:bg-teal-50">
                            <span className="text-sm font-semibold uppercase tracking-[0.25em] text-teal-700">Medical PDF</span>
                            <span className="mt-3 text-2xl font-semibold text-slate-900">{file ? file.name : "Drop a report here or browse"}</span>
                            <span className="mt-2 text-sm text-slate-500">
                                Accepted format: PDF. The raw file will be encrypted before storage.
                            </span>
                            <input type="file" accept="application/pdf" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                        </label>

                        {error ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                {error}
                            </div>
                        ) : null}

                        <div className="flex flex-wrap gap-3">
                            <button
                                type="submit"
                                disabled={isSubmitting || !isAuthenticated}
                                className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? "Uploading securely..." : "Encrypt and Upload"}
                            </button>
                            <Link href="/patient" className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white">
                                Back to Dashboard
                            </Link>
                        </div>
                    </form>
                </section>

                <section className="space-y-6">
                    <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-300">Security Checklist</p>
                        <ul className="mt-5 space-y-3 text-sm text-slate-300">
                            <li>Files are encrypted before they leave the backend.</li>
                            <li>Only IPFS hashes and permissions are written on-chain.</li>
                            <li>Consent actions remain traceable through immutable logs.</li>
                            <li>AI summaries are generated from extracted report text, not from wallet data.</li>
                        </ul>
                    </div>

                    <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-slate-200/60">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Upload Result</p>
                        {uploadResult ? (
                            <div className="mt-5 space-y-5">
                                <div className="rounded-[1.5rem] bg-slate-50 p-4">
                                    <p className="text-sm text-slate-500">Record</p>
                                    <p className="mt-2 text-lg font-semibold text-slate-900">{uploadResult.record?.fileName || "New medical record"}</p>
                                    <p className="mt-1 text-sm text-slate-600">
                                        Type: {uploadResult.record?.recordType} • Hash: {uploadResult.record?.ipfsHash}
                                    </p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="rounded-[1.5rem] border border-slate-200 p-4">
                                        <p className="text-sm font-medium text-slate-500">Storage</p>
                                        <p className="mt-2 text-sm text-slate-800">{uploadResult.storage?.provider}</p>
                                        <a href={uploadResult.storage?.gatewayUrl} className="mt-2 inline-block break-all text-sm text-sky-700 underline">
                                            {uploadResult.storage?.gatewayUrl}
                                        </a>
                                    </div>
                                    <div className="rounded-[1.5rem] border border-slate-200 p-4">
                                        <p className="text-sm font-medium text-slate-500">Encryption</p>
                                        <p className="mt-2 text-sm text-slate-800">{uploadResult.encryption?.algorithm}</p>
                                        <p className="mt-1 break-all text-xs text-slate-500">Key hash: {uploadResult.encryption?.keyHash}</p>
                                    </div>
                                </div>

                                <div className="rounded-[1.5rem] bg-teal-50 p-5">
                                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-teal-700">AI Preview</p>
                                    <p className="mt-3 text-sm leading-6 text-slate-700">{uploadResult.aiSummary?.medicalSummary}</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {(uploadResult.aiSummary?.conditionsDetected || []).map((condition) => (
                                            <span key={condition} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                                {condition}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                Upload a PDF to preview the encrypted storage result, IPFS hash, and AI summary response.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
