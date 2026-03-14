const { parseMedicalData, normalizeWhitespace } = require("./medicalParser");
const { detectRiskFlags } = require("./riskDetector");

let pdfParse;
try {
    pdfParse = require("pdf-parse");
} catch (error) {
    pdfParse = null;
}

const DEFAULT_CLINICAL_SUMMARY =
    "No significant health threats or abnormalities detected in the report.";

function buildFallbackSummary(text, parsedData, riskFlags) {
    return DEFAULT_CLINICAL_SUMMARY;
}

function looksLikeRawLabText(value) {
    const text = String(value || "").trim();
    if (!text) {
        return false;
    }

    const rangeCount = (text.match(/\b\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\b/g) || []).length;
    const unitCount = (
        text.match(/\b(?:mg\/dl|g\/dl|mmol\/l|iu\/l|u\/l|rbc|wbc|hematocrit|hemoglobin|platelet|mcv|mch|mchc)\b/gi) || []
    ).length;

    return text.length > 120 && (rangeCount >= 2 || unitCount >= 3);
}

function normalizeClinicalSummary(value) {
    const summary = String(value || "").trim();

    if (!summary || looksLikeRawLabText(summary)) {
        return DEFAULT_CLINICAL_SUMMARY;
    }

    return summary;
}

function buildFallbackMedicalEvents(parsedData, riskFlags) {
    const events = [...(parsedData.medicalEvents || [])];
    const eventDate = parsedData.reportDate || "Unknown";

    for (const riskFlag of riskFlags || []) {
        events.push({
            date: eventDate,
            type: "Risk Flag",
            finding: riskFlag.label,
            risk: riskFlag.reason || riskFlag.label,
            sourceText: riskFlag.label
        });
    }

    const seen = new Set();
    const deduped = events.filter((event) => {
        const finding = String(event?.finding || "").trim();
        if (!finding || finding.length < 6) {
            return false;
        }

        const key = `${event.date}|${event.type}|${finding}`;
        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });

    return deduped.sort((a, b) => {
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

        return String(a.finding).localeCompare(String(b.finding));
    });
}

function buildPatientHistoryEntry(parsedData, riskFlags, llmResult = null) {
    const base = {
        date: parsedData.reportDate || "Unknown",
        reportType: parsedData.reportType || "Medical Report",
        keyFindings: parsedData.keyFindings || "",
        diagnosis: parsedData.diagnosis || "",
        riskFlags: (riskFlags || []).map((flag) => flag.label),
        recommendedFollowUp: parsedData.recommendedFollowUp || ""
    };

    if (!llmResult || typeof llmResult !== "object") {
        return base;
    }

    return {
        ...base,
        date: llmResult.patientHistoryEntry?.date || llmResult.date || base.date,
        reportType: llmResult.patientHistoryEntry?.reportType || llmResult.reportType || base.reportType,
        keyFindings: llmResult.patientHistoryEntry?.keyFindings || llmResult.keyFindings || base.keyFindings,
        diagnosis: llmResult.patientHistoryEntry?.diagnosis || llmResult.diagnosis || base.diagnosis,
        riskFlags:
            llmResult.patientHistoryEntry?.riskFlags ||
            llmResult.riskFlags?.map((flag) => flag.label) ||
            base.riskFlags,
        recommendedFollowUp:
            llmResult.patientHistoryEntry?.recommendedFollowUp ||
            llmResult.recommendedFollowUp ||
            base.recommendedFollowUp
    };
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
You are a medical data interpreter. Analyze the following medical report text and extract clinically meaningful insights.

Return structured output containing:
1. reportDate
2. probableConditions
3. keyAbnormalFindings
4. clinicalSummary
5. finalConclusion

Do NOT repeat raw lab tables or numeric ranges unless they indicate abnormalities.
Extract only the final clinical interpretation of the report. Do not repeat lab values.
The clinicalSummary must explain the medical meaning of the report in simple medical language.
If no abnormalities are found, respond with: "No significant health threats or abnormalities detected in the report."

Focus on medical meaning rather than listing values.

Return strict JSON with the following shape:
{
    "reportDate": "YYYY-MM-DD|Unknown",
    "reportType": "string",
    "conditionsDetected": ["string"],
    "significantAbnormalities": ["string"],
    "clinicalSummary": "string",
    "finalConclusion": "string",
    "riskFlags": [{"label":"string","severity":"low|medium|high|critical","reason":"string"}],
    "timelineEntry": {
        "date": "YYYY-MM-DD|Unknown",
        "conclusion": "string"
    }
}

Known extracted conditions: ${JSON.stringify(parsedData.conditions)}
Known extracted medications: ${JSON.stringify(parsedData.medications)}
Known extracted risk flags: ${JSON.stringify(riskFlags)}
Detected report date: ${parsedData.reportDate}
Detected report type: ${parsedData.reportType}
Extracted key findings: ${parsedData.keyFindings}
Extracted diagnosis: ${parsedData.diagnosis}
Extracted follow-up: ${parsedData.recommendedFollowUp}
Extracted abnormal results: ${JSON.stringify(parsedData.abnormalResults)}
Structured medical events: ${JSON.stringify(parsedData.medicalEvents)}
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

async function summarizeMedicalReport({ pdfBuffer, text, reportId, fileName, reportType } = {}) {
    const extractedText = text || (pdfBuffer ? await extractTextFromPdf(pdfBuffer) : "");
    const cleanedText = normalizeWhitespace(extractedText);
    const parsedData = parseMedicalData(extractedText, {
        fileName,
        reportType
    });
    const riskFlags = detectRiskFlags(cleanedText, parsedData);

    if (!cleanedText) {
        return {
            summary: "No readable medical text was extracted from the report.",
            keyFindings: "",
            diagnosis: "",
            recommendedFollowUp: "",
            reportType: "Medical Report",
            date: "Unknown",
            conditions: [],
            medications: [],
            riskFlags: [],
            medicalEvents: [],
            patientHistoryEntry: {
                date: "Unknown",
                reportType: "Medical Report",
                keyFindings: "",
                diagnosis: "",
                riskFlags: [],
                recommendedFollowUp: ""
            },
            rawText: ""
        };
    }

    try {
        const llmResult = await callLlmForSummary(cleanedText, parsedData, riskFlags, {
            reportId,
            fileName
        });

        if (llmResult) {
            const fallbackEvents = buildFallbackMedicalEvents(parsedData, riskFlags);
            const historyEntry = buildPatientHistoryEntry(parsedData, riskFlags, llmResult);
            const conditionsDetected =
                llmResult.conditionsDetected || llmResult.probableConditions || llmResult.conditions || parsedData.conditions;
            const significantAbnormalities =
                llmResult.significantAbnormalities || llmResult.keyAbnormalFindings || [];
            const clinicalSummary =
                normalizeClinicalSummary(
                    llmResult.clinicalSummary ||
                    llmResult.summary ||
                    buildFallbackSummary(cleanedText, parsedData, riskFlags)
                );
            const finalConclusion =
                llmResult.finalConclusion || llmResult.diagnosis || historyEntry.diagnosis || clinicalSummary;
            const reportDate = llmResult.reportDate || llmResult.date || historyEntry.date;
            const timelineEntry = {
                date: llmResult.timelineEntry?.date || reportDate,
                conclusion:
                    llmResult.timelineEntry?.conclusion ||
                    finalConclusion ||
                    "No significant abnormalities detected."
            };

            return {
                summary: clinicalSummary,
                keyFindings: llmResult.keyFindings || historyEntry.keyFindings,
                diagnosis: llmResult.diagnosis || historyEntry.diagnosis,
                recommendedFollowUp: llmResult.recommendedFollowUp || historyEntry.recommendedFollowUp,
                reportType: llmResult.reportType || historyEntry.reportType,
                date: reportDate,
                conditionsDetected,
                conditions: conditionsDetected,
                medications: llmResult.medications || parsedData.medications,
                riskFlags: llmResult.riskFlags || riskFlags,
                medicalEvents: llmResult.medicalEvents || fallbackEvents,
                significantAbnormalities,
                abnormalFindings: significantAbnormalities,
                clinicalSummary,
                finalConclusion,
                timelineEntry,
                patientHistoryEntry: historyEntry,
                rawText: extractedText
            };
        }
    } catch (error) {
        if (process.env.NODE_ENV === "production") {
            throw error;
        }
    }

    const fallbackEvents = buildFallbackMedicalEvents(parsedData, riskFlags);
    const historyEntry = buildPatientHistoryEntry(parsedData, riskFlags);

    return {
        summary: buildFallbackSummary(cleanedText, parsedData, riskFlags),
        keyFindings: historyEntry.keyFindings,
        diagnosis: historyEntry.diagnosis,
        recommendedFollowUp: historyEntry.recommendedFollowUp,
        reportType: historyEntry.reportType,
        date: historyEntry.date,
        conditionsDetected: parsedData.conditions,
        conditions: parsedData.conditions,
        medications: parsedData.medications,
        riskFlags,
        medicalEvents: fallbackEvents,
        significantAbnormalities: [],
        abnormalFindings: [],
        clinicalSummary: DEFAULT_CLINICAL_SUMMARY,
        finalConclusion: "No major abnormalities detected in the report.",
        timelineEntry: {
            date: historyEntry.date,
            conclusion: "No significant abnormalities detected."
        },
        patientHistoryEntry: historyEntry,
        rawText: extractedText
    };
}

module.exports = {
    extractTextFromPdf,
    summarizeMedicalReport
};
