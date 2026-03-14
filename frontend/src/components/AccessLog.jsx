import React from "react";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
});

function formatDate(value) {
    if (!value) {
        return "No access recorded";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return dateFormatter.format(date);
}

export default function AccessLog({ analytics = [] }) {
    if (!analytics.length) {
        return (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Doctor access analytics will appear here after a doctor opens one of your records.
            </div>
        );
    }

    return (
        <div className="grid gap-4">
            {analytics.map((entry) => (
                <article
                    key={entry.doctorAddress}
                    className="rounded-[1.5rem] border border-slate-200 bg-white p-5"
                >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">
                                {entry.doctorName || entry.doctorAddress}
                            </h3>
                            <p className="mt-1 break-all text-sm text-slate-500">
                                {entry.doctorAddress}
                            </p>
                        </div>
                        <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                Total Accesses
                            </p>
                            <p className="mt-2 text-2xl font-semibold">{entry.accessCount}</p>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-slate-600">
                        Last accessed {formatDate(entry.lastAccessed)}
                    </p>
                </article>
            ))}
        </div>
    );
}
