const { parseMedicalData, normalizeWhitespace } = require("./medicalParser");
const { detectRiskFlags } = require("./riskDetector");

let pdfParse;
try {
    pdfParse = require("pdf-parse");
} catch (error) {
    pdfParse = null;
}

function buildFallbackSummary(text, parsedData, riskFlags) {
    const sentences = normalizeWhitespace(text)
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

    const coreSummary =
        sentences.slice(0, 3).join(" ") || "Medical report text was extracted but a detailed summary was not available.";

    const highlights = [];

    if (parsedData.conditions.length) {
        highlights.push(`Conditions noted: ${parsedData.conditions.slice(0, 4).join(", ")}.`);
    }

    if (parsedData.medications.length) {
        highlights.push(`Medications noted: ${parsedData.medications.slice(0, 4).join(", ")}.`);
    }

    if (riskFlags.length) {
        highlights.push(`Risk flags: ${riskFlags.map((flag) => flag.label).slice(0, 3).join(", ")}.`);
    }

    return [coreSummary, ...highlights].join(" ").trim();
}

function buildFallbackMedicalEvents(parsedData, riskFlags) {
    const events = [...(parsedData.medicalEvents || [])];

    for (const condition of parsedData.conditions || []) {
        events.push({
            date: "Unknown",
            type: "Diagnosis",
            finding: condition,
            risk: `${condition} management`,
            sourceText: `Detected condition: ${condition}`
        });
    }

    for (const medication of parsedData.medications || []) {
        events.push({
            date: "Unknown",
            type: "Medication",
            finding: medication,
            risk: "Medication reconciliation",
            sourceText: `Detected medication: ${medication}`
        });
    }

    for (const riskFlag of riskFlags || []) {
        events.push({
            date: "Unknown",
            type: "Risk Flag",
            finding: riskFlag.label,
            risk: riskFlag.reason || riskFlag.label,
            sourceText: riskFlag.label
        });
    }

    const seen = new Set();

    return events.filter((event) => {
        const key = `${event.date}|${event.type}|${event.finding}`;
        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

async function extractTextFromPdf(pdfInput) {
    if (!pdfInput) {
        return "";
    }

    const buffer = Buffer.isBuffer(pdfInput) ? pdfInput : Buffer.from(pdfInput);

    if (pdfParse) {
        const result = await pdfParse(buffer);
        return result.text || "";
    }

    return buffer.toString("utf8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
}

async function callLlmForSummary(text, parsedData, riskFlags, options = {}) {
    const endpoint = process.env.AI_SUMMARY_ENDPOINT;

    if (!endpoint) {
        return null;
    }

    const prompt = `
You are a clinical documentation assistant.
Summarize the medical report into concise plain English.
Return strict JSON with the following shape:
{
  "summary": "string",
  "conditions": ["string"],
  "medications": ["string"],
  "riskFlags": [{"label":"string","severity":"low|medium|high|critical","reason":"string"}],
  "medicalEvents": [{"date":"YYYY-MM-DD|Unknown","type":"string","finding":"string","risk":"string","sourceText":"string"}]
}

Known extracted conditions: ${JSON.stringify(parsedData.conditions)}
Known extracted medications: ${JSON.stringify(parsedData.medications)}
Known extracted risk flags: ${JSON.stringify(riskFlags)}
Medical events: ${JSON.stringify(parsedData.medicalEvents)}
Report text:
${text.slice(0, 12000)}
`.trim();

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(process.env.AI_SUMMARY_API_KEY
                ? { Authorization: `Bearer ${process.env.AI_SUMMARY_API_KEY}` }
                : {})
        },
        body: JSON.stringify({
            model: process.env.AI_SUMMARY_MODEL || "medical-summary",
            prompt,
            reportId: options.reportId || null
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM summary failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const candidate = payload.result || payload.output || payload.data || payload;

    if (typeof candidate === "string") {
        return JSON.parse(candidate);
    }

    return candidate;
}

async function summarizeMedicalReport({ pdfBuffer, text, reportId, fileName } = {}) {
    const extractedText = text || (pdfBuffer ? await extractTextFromPdf(pdfBuffer) : "");
    const cleanedText = normalizeWhitespace(extractedText);
    const parsedData = parseMedicalData(extractedText);
    const riskFlags = detectRiskFlags(cleanedText, parsedData);

    if (!cleanedText) {
        return {
            summary: "No readable medical text was extracted from the report.",
            conditions: [],
            medications: [],
            riskFlags: [],
            medicalEvents: [],
            rawText: ""
        };
    }

    try {
        const llmResult = await callLlmForSummary(cleanedText, parsedData, riskFlags, {
            reportId,
            fileName
        });

        if (llmResult) {
            return {
                summary: llmResult.summary || buildFallbackSummary(cleanedText, parsedData, riskFlags),
                conditions: llmResult.conditions || parsedData.conditions,
                medications: llmResult.medications || parsedData.medications,
                riskFlags: llmResult.riskFlags || riskFlags,
                medicalEvents:
                    llmResult.medicalEvents || buildFallbackMedicalEvents(parsedData, riskFlags),
                rawText: extractedText
            };
        }
    } catch (error) {
        if (process.env.NODE_ENV === "production") {
            throw error;
        }
    }

    return {
        summary: buildFallbackSummary(cleanedText, parsedData, riskFlags),
        conditions: parsedData.conditions,
        medications: parsedData.medications,
        riskFlags,
        medicalEvents: buildFallbackMedicalEvents(parsedData, riskFlags),
        rawText: extractedText
    };
}

module.exports = {
    extractTextFromPdf,
    summarizeMedicalReport
};
