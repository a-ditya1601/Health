import Link from "next/link";

const featureCards = [
    {
        title: "Patient Dashboard",
        description:
            "Upload encrypted medical records, manage doctor permissions, review consent logs, and track AI-generated medical insights.",
        actions: [
            { label: "Upload Medical Record", href: "/upload" },
            { label: "Grant Access", href: "/grant-access" }
        ]
    },
    {
        title: "Doctor Dashboard",
        description:
            "Request patient access, review granted records, read AI summaries, and trigger the emergency access workflow when needed.",
        actions: [
            { label: "View Records", href: "/view-records" },
            { label: "Emergency Access", href: "/emergency" }
        ]
    }
];

export default function HomePage() {
    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.14),_transparent_28%),linear-gradient(180deg,_#f8fffe_0%,_#eef6ff_48%,_#fff9f0_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl">
                <section className="overflow-hidden rounded-[2.25rem] bg-slate-950 text-white shadow-2xl shadow-slate-300/40">
                    <div className="grid gap-8 px-6 py-10 md:grid-cols-[1.2fr_0.8fr] md:px-10 lg:px-12">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-teal-300">
                                Patient-Owned Health Data
                            </p>
                            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
                                Secure medical records with patient control, doctor access windows,
                                and AI-assisted clinical summaries.
                            </h1>
                            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                                This platform keeps medical files off-chain, encrypts reports before
                                storage, records consent actions immutably, and gives both patients
                                and doctors dedicated workflows.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <Link
                                    href="/patient"
                                    className="rounded-full bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-300"
                                >
                                    Open Patient Dashboard
                                </Link>
                                <Link
                                    href="/doctor"
                                    className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
                                >
                                    Open Doctor Dashboard
                                </Link>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                                    Core Stack
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {["Next.js", "Node.js", "Polygon", "IPFS", "MongoDB", "AI Service"].map(
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
                                    Key Rule
                                </p>
                                <p className="mt-3 text-sm leading-6 text-slate-200">
                                    Medical files are not stored on-chain. Only hashes, permissions,
                                    and consent activity are recorded on Polygon.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-8 grid gap-6 lg:grid-cols-2">
                    {featureCards.map((card) => (
                        <article
                            key={card.title}
                            className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-slate-200/60"
                        >
                            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-700">
                                {card.title}
                            </p>
                            <p className="mt-4 text-sm leading-7 text-slate-600">
                                {card.description}
                            </p>
                            <div className="mt-6 flex flex-wrap gap-3">
                                {card.actions.map((action) => (
                                    <Link
                                        key={action.label}
                                        href={action.href}
                                        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                                    >
                                        {action.label}
                                    </Link>
                                ))}
                            </div>
                        </article>
                    ))}
                </section>
            </div>
        </main>
    );
}
