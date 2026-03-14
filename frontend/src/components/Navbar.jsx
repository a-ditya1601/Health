import Link from "next/link";

export default function Navbar() {
    return (
        <header className="sticky top-0 z-20 border border-white/60 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
                <Link href="/" className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                        PH
                    </div>
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-teal-700">
                            Patient-Owned
                        </p>
                        <p className="text-lg font-semibold text-slate-950">Health Data</p>
                    </div>
                </Link>

                <Link
                    href="/auth"
                    className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                    Sign In
                </Link>
            </div>
        </header>
    );
}
