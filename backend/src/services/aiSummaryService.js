const AI_SERVICE_URL =
    process.env.AI_SERVICE_URL || "http://localhost:8000/api/summarize";

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

        return {
            medicalSummary: result.summary || fallbackSummary(normalizedText),
            riskFlags: result.riskFlags || [],
            conditionsDetected: result.conditions || [],
            medications: result.medications || [],
            timelineEvents: result.medicalEvents || [],
            timeline: result.medicalEvents || [],
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
            rawText: normalizedText
        };
    }
}

module.exports = {
    generateSummary
};
