import Link from "next/link";

export default function AuthPage() {
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

                    <div className="mt-10 grid gap-5 md:grid-cols-2">
                        <Link
                            href="/patient"
                            className="rounded-[2rem] border border-slate-200 bg-slate-950 px-6 py-8 text-left text-white transition hover:bg-slate-800"
                        >
                            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-300">
                                Patient
                            </p>
                            <h2 className="mt-3 text-2xl font-semibold">
                                Sign in as Patient
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-slate-300">
                                Access your records, uploads, permissions, consent logs, and AI summaries.
                            </p>
                        </Link>

                        <Link
                            href="/doctor"
                            className="rounded-[2rem] border border-slate-200 bg-white px-6 py-8 text-left text-slate-900 transition hover:border-sky-300 hover:bg-sky-50"
                        >
                            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">
                                Doctor
                            </p>
                            <h2 className="mt-3 text-2xl font-semibold">
                                Sign in as Doctor
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                Review patient records, request access, and use emergency workflows when authorized.
                            </p>
                        </Link>
                    </div>
                </section>
            </div>
        </main>
    );
}
