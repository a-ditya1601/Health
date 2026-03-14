import Navbar from "../components/Navbar";

const platformPillars = [
    {
        title: "What Patient-Owned Health Data is",
        description:
            "A patient-controlled health records platform where encrypted medical files stay off-chain while consent, access rights, and audit events are tracked transparently."
    },
    {
        title: "Why medical data ownership matters",
        description:
            "Patients should decide who can access their reports, for how long, and under what conditions. That model reduces opaque data sharing and gives people direct control over sensitive health history."
    },
    {
        title: "How blockchain and IPFS are used",
        description:
            "Medical files are encrypted and stored in IPFS. Polygon smart contracts record hashes, permissions, consent changes, and access logs so the system stays auditable without exposing the underlying records on-chain."
    }
];

const howItWorks = [
    "A patient connects a wallet and registers as a patient account.",
    "The medical report is encrypted, stored in IPFS, and referenced on-chain by hash.",
    "Doctors request access, and patients grant or revoke time-limited permissions.",
    "Every consent and access action is logged, while AI services generate summaries and structured timelines from report content."
];

export default function HomePage() {
    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.14),_transparent_26%),linear-gradient(180deg,_#f8fffe_0%,_#eef6ff_45%,_#fff9f0_100%)] text-slate-900">
            <Navbar />

            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
                <section className="overflow-hidden rounded-[2.5rem] bg-slate-950 text-white shadow-2xl shadow-slate-300/40">
                    <div className="grid gap-10 px-6 py-12 md:grid-cols-[1.15fr_0.85fr] md:px-10 lg:px-12">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-teal-300">
                                Patient-Owned Health Data
                            </p>
                            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
                                A patient-first infrastructure for secure records, consent control, and accountable clinical access.
                            </h1>
                            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                                The platform combines wallet identity, encrypted storage, blockchain-based permissions, and AI-assisted report understanding so health data can move without losing patient control.
                            </p>
                        </div>

                        <div className="grid gap-4">
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                                    Core Stack
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {["Next.js", "Node.js", "MongoDB", "Polygon", "IPFS", "AI Service"].map(
                                        (item) => (
                                            <span
                                                key={item}
                                                className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white"
                                            >
                                                {item}
                                            </span>
                                        )
                                    )}
                                </div>
                            </div>

                            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                                    Architectural Rule
                                </p>
                                <p className="mt-3 text-sm leading-6 text-slate-200">
                                    Medical files are never stored on-chain. Only hashes, permissions,
                                    and access events are written to Polygon.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-10 grid gap-6 lg:grid-cols-3">
                    {platformPillars.map((pillar) => (
                        <article
                            key={pillar.title}
                            className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-slate-200/60"
                        >
                            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-700">
                                Platform
                            </p>
                            <h2 className="mt-4 text-2xl font-semibold text-slate-900">
                                {pillar.title}
                            </h2>
                            <p className="mt-4 text-sm leading-7 text-slate-600">
                                {pillar.description}
                            </p>
                        </article>
                    ))}
                </section>

                <section className="mt-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                    <article className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-slate-200/60">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
                            Why it matters
                        </p>
                        <h2 className="mt-4 text-3xl font-semibold text-slate-900">
                            Health records should move with the patient, not around the patient.
                        </h2>
                        <p className="mt-4 text-sm leading-7 text-slate-600">
                            Traditional record exchange often leaves patients outside the consent path.
                            This platform changes that by making the wallet the identity anchor and
                            the permission model explicit, time-bound, and auditable.
                        </p>
                    </article>

                    <article className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-slate-200/60">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">
                            How it works
                        </p>
                        <div className="mt-5 space-y-4">
                            {howItWorks.map((step, index) => (
                                <div
                                    key={step}
                                    className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                                            {index + 1}
                                        </div>
                                        <p className="pt-1 text-sm leading-7 text-slate-700">{step}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </article>
                </section>
            </div>
        </main>
    );
}
