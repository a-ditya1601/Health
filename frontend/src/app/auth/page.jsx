"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

export default function AuthPage() {
    const router = useRouter();
    const { connectWallet } = useAuth();
    const [isConnecting, setIsConnecting] = useState(false);
    const [authError, setAuthError] = useState("");
    const [statusMessage, setStatusMessage] = useState("");

    const handleConnect = async (role) => {
        try {
            setIsConnecting(true);
            setAuthError("");
            setStatusMessage("Connecting to MetaMask...");
            const connectedAddress = await connectWallet();
            
            if (!connectedAddress) {
                throw new Error("Failed to get connected wallet address.");
            }

            setStatusMessage("Checking registration status...");
            // Verify if the user is already registered on the backend
            // For Patient
            if (role === "patient") {
                const checkRes = await fetch(`${API_BASE}/records/patient/${connectedAddress}`, {
                    headers: {
                        "x-wallet-address": connectedAddress
                    }
                });
                
                const payload = await checkRes.json();
                
                // Usually backend throws a "Patient is not registered" error if there's no data.
                // It might return 400 or 500 when not registered depending on the error handler.
                if (!checkRes.ok && (payload.message?.toLowerCase().includes("not registered") || payload.error?.toLowerCase().includes("not registered"))) {
                    setStatusMessage("Not registered. Registering wallet as Patient...");
                    const regRes = await fetch(`${API_BASE}/patients/register`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            patientAddress: connectedAddress,
                            metadataURI: ""
                        })
                    });
                    
                    if (!regRes.ok) {
                        const regPayload = await regRes.json();
                        throw new Error(regPayload.message || "Failed to auto-register Patient.");
                    }
                }
            } else if (role === "doctor") {
                 // For Doctor
                 const checkRes = await fetch(`${API_BASE}/doctors/${connectedAddress}/records`, {
                    headers: {
                        "x-wallet-address": connectedAddress
                    }
                });
                
                const payload = await checkRes.json();
                 
                if (!checkRes.ok && (payload.message?.toLowerCase().includes("not registered") || payload.error?.toLowerCase().includes("not registered"))) {
                    setStatusMessage("Not registered. Registering wallet as Doctor...");
                    const regRes = await fetch(`${API_BASE}/doctors/register`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            doctorAddress: connectedAddress,
                            metadataURI: ""
                        })
                    });
                    
                    if (!regRes.ok) {
                        const regPayload = await regRes.json();
                        throw new Error(regPayload.message || "Failed to auto-register Doctor.");
                    }
                }
            }

            setStatusMessage("Redirecting...");
            router.push(`/${role}`);
        } catch (error) {
            console.error("Auth error:", error);
            setAuthError(error.message || "Failed to connect wallet.");
        } finally {
            setIsConnecting(false);
            setStatusMessage("");
        }
    };

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.14),_transparent_28%),linear-gradient(180deg,_#f8fffe_0%,_#eef6ff_48%,_#fff9f0_100%)] px-4 py-10 text-slate-900 sm:px-6 lg:px-10">
            <div className="mx-auto flex min-h-[80vh] max-w-4xl items-center justify-center">
                <section className="w-full rounded-[2.5rem] border border-slate-200 bg-white/90 p-8 text-center shadow-2xl shadow-slate-200/60 md:p-12">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-slate-950 text-lg font-semibold text-white">
                        PH
                    </div>
                    <p className="mt-5 text-sm font-semibold uppercase tracking-[0.35em] text-teal-700">
                        Patient-Owned Health Data
                    </p>
                    <h1 className="mt-4 text-4xl font-semibold text-slate-950 md:text-5xl">
                        How would you like to sign in?
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                        Your wallet will be used to authenticate your identity.
                    </p>

                    {authError ? (
                        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            {authError}
                        </div>
                    ) : null}

                    <div className="mt-10 grid gap-5 md:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => handleConnect("patient")}
                            disabled={isConnecting}
                            className={`rounded-[2rem] border border-slate-200 bg-slate-950 px-6 py-8 text-left text-white transition ${
                                isConnecting ? "cursor-not-allowed opacity-70" : "hover:bg-slate-800"
                            }`}
                        >
                            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-300">
                                Patient
                            </p>
                            <h2 className="mt-3 text-2xl font-semibold">
                                {isConnecting && statusMessage ? statusMessage : "Sign in as Patient"}
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-slate-300">
                                Access your records, uploads, permissions, consent logs, and AI summaries.
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleConnect("doctor")}
                            disabled={isConnecting}
                            className={`rounded-[2rem] border border-slate-200 bg-white px-6 py-8 text-left text-slate-900 transition ${
                                isConnecting ? "cursor-not-allowed opacity-70" : "hover:border-sky-300 hover:bg-sky-50"
                            }`}
                        >
                            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">
                                Doctor
                            </p>
                            <h2 className="mt-3 text-2xl font-semibold">
                                {isConnecting && statusMessage ? statusMessage : "Sign in as Doctor"}
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                Review patient records, request access, and use emergency workflows when authorized.
                            </p>
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
}
