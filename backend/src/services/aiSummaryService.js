const AI_SERVICE_URL =
    process.env.AI_SERVICE_URL || "http://localhost:8000/api/summarize";

function sortTimelineEvents(events = []) {
    const filtered = (Array.isArray(events) ? events : [])
        .map((event) => ({
            date: event?.date || "Unknown",
            type: event?.type || "Clinical Note",
            finding: String(event?.finding || "").trim(),
            risk: String(event?.risk || "").trim(),
            sourceText: String(event?.sourceText || "").trim()
        }))
        .filter((event) => event.finding.length >= 6);

    return filtered.sort((a, b) => {
        const aKnown = a.date && a.date !== "Unknown";
        const bKnown = b.date && b.date !== "Unknown";

        if (aKnown && bKnown) {
            return new Date(a.date) - new Date(b.date);
        }

        if (aKnown && !bKnown) {
            return -1;
        }

        if (!aKnown && bKnown) {
            return 1;
        }

        return a.finding.localeCompare(b.finding);
    });
}

function fallbackSummary(text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    const sentences = normalized
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

    return sentences.slice(0, 3).join(" ") || "No readable medical text was extracted from the report.";
}

async function generateSummary({ text, fileName, recordType }) {
    const normalizedText = String(text || "").trim();

    if (!normalizedText) {
        return {
            medicalSummary: "No extractable text was found in the document.",
            riskFlags: [],
            conditionsDetected: [],
            medications: [],
            timelineEvents: [],
            timeline: [],
            patientHistoryEntry: {
                date: "Unknown",
                reportType: recordType || "Medical Report",
                keyFindings: "",
                diagnosis: "",
                riskFlags: [],
                recommendedFollowUp: ""
            },
            rawText: ""
        };
    }

    try {
        const response = await fetch(AI_SERVICE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: normalizedText,
                fileName,
                recordType
            })
        });

        if (!response.ok) {
            throw new Error(`AI service returned ${response.status}`);
        }

        const payload = await response.json();
        const result = payload.data || payload;
        const timelineEvents = sortTimelineEvents(result.medicalEvents || []);
        const patientHistoryEntry = result.patientHistoryEntry || {
            date: result.date || "Unknown",
            reportType: result.reportType || recordType || "Medical Report",
            keyFindings: result.keyFindings || "",
            diagnosis: result.diagnosis || "",
            riskFlags: (result.riskFlags || []).map((flag) => flag.label),
            recommendedFollowUp: result.recommendedFollowUp || ""
        };

        return {
            medicalSummary: result.summary || fallbackSummary(normalizedText),
            riskFlags: result.riskFlags || [],
            conditionsDetected: result.conditions || [],
            medications: result.medications || [],
            timelineEvents,
            timeline: timelineEvents,
            patientHistoryEntry,
            rawText: result.rawText || normalizedText
        };
    } catch (error) {
        if (process.env.NODE_ENV === "production") {
            throw error;
        }

        return {
            medicalSummary: fallbackSummary(normalizedText),
            riskFlags: [],
            conditionsDetected: [],
            medications: [],
            timelineEvents: [],
            timeline: [],
            patientHistoryEntry: {
                date: "Unknown",
                reportType: recordType || "Medical Report",
                keyFindings: "",
                diagnosis: "",
                riskFlags: [],
                recommendedFollowUp: ""
            },
            rawText: normalizedText
        };
    }
}

module.exports = {
    generateSummary
};
