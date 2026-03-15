const AI_API_URL = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const AI_API_KEY = process.env.AI_API_KEY || "";
const DEFAULT_CLINICAL_SUMMARY =
    "No significant health threats or abnormalities detected in the report.";

function extractJsonObject(content) {
    if (!content || typeof content !== "string") {
        throw new Error("AI response content was empty");
    }

    const trimmed = content.trim();

    try {
        return JSON.parse(trimmed);
    } catch (error) {
        const firstBrace = trimmed.indexOf("{");
        const lastBrace = trimmed.lastIndexOf("}");

        if (firstBrace >= 0 && lastBrace > firstBrace) {
            return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
        }

        throw error;
    }
}

async function callAiJson(prompt) {
    if (!AI_API_KEY) {
        throw new Error("AI_API_KEY is not configured");
    }

    const response = await fetch(AI_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AI_API_KEY}`
        },
        body: JSON.stringify({
            model: AI_MODEL,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content:
                        "You are a clinical documentation assistant. Return only strict JSON with medically meaningful output."
                },
                {
                    role: "user",
                    content: prompt
                }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API request failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    return extractJsonObject(content);
}

function normalizeRiskFlags(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((flag) => {
            if (!flag) {
                return null;
            }

            if (typeof flag === "string") {
                return {
                    label: flag,
                    severity: "medium",
                    reason: flag
                };
            }

            return {
                label: String(flag.label || flag.name || "Clinical risk").trim(),
                severity: String(flag.severity || "medium").trim().toLowerCase(),
                reason: String(flag.reason || flag.label || "").trim()
            };
        })
        .filter((flag) => flag?.label);
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

async function generateMedicalSummary(reportText) {
    const normalizedText = String(reportText || "").trim();

    const prompt = `
You are a medical data interpreter. Analyze the following medical report text and extract clinically meaningful insights.

Return structured output containing:
1. reportDate
2. conditionsDetected
3. significantAbnormalities
4. clinicalSummary
5. finalConclusion
6. healthRisks (analyzes the risks involved with the specific sickness/conditions)
7. lifestyleRecommendations (actionable lifestyle changes the patient can do to improve their condition)

Do NOT repeat raw lab tables or numeric ranges unless they indicate abnormalities.
The clinicalSummary must explain the medical meaning of the report in simple medical language.
If no abnormalities are found, set clinicalSummary to: "No significant health threats or abnormalities detected in the report."
Focus on medical meaning rather than listing values.

Return JSON with this exact shape:
{
  "reportDate": "YYYY-MM-DD or Unknown",
  "conditionsDetected": ["string"],
  "significantAbnormalities": ["string"],
  "clinicalSummary": "string",
  "finalConclusion": "string",
  "healthRisks": ["string"],
  "lifestyleRecommendations": ["string"],
  "reportType": "string",
  "riskFlags": [{"label":"string","severity":"low|medium|high|critical","reason":"string"}]
}

Report text:
${normalizedText.slice(0, 250000)}
`.trim();

    const result = await callAiJson(prompt);

    const conditionsDetected = Array.isArray(result.conditionsDetected)
        ? result.conditionsDetected.map((item) => String(item || "").trim()).filter(Boolean)
        : Array.isArray(result.probableConditions)
            ? result.probableConditions.map((item) => String(item || "").trim()).filter(Boolean)
        : [];

    const significantAbnormalities = Array.isArray(result.significantAbnormalities)
        ? result.significantAbnormalities.map((item) => String(item || "").trim()).filter(Boolean)
        : Array.isArray(result.keyAbnormalFindings)
            ? result.keyAbnormalFindings.map((item) => String(item || "").trim()).filter(Boolean)
        : [];

    const healthRisks = Array.isArray(result.healthRisks)
        ? result.healthRisks.map((item) => String(item || "").trim()).filter(Boolean)
        : [];

    const lifestyleRecommendations = Array.isArray(result.lifestyleRecommendations)
        ? result.lifestyleRecommendations.map((item) => String(item || "").trim()).filter(Boolean)
        : [];

    return {
        reportDate: String(result.reportDate || "Unknown").trim() || "Unknown",
        reportType: String(result.reportType || "Medical Report").trim(),
        conditionsDetected,
        significantAbnormalities,
        conditions: conditionsDetected,
        abnormalFindings: significantAbnormalities,
        healthRisks,
        lifestyleRecommendations,
        clinicalSummary: normalizeClinicalSummary(result.clinicalSummary),
        finalConclusion: String(result.finalConclusion || "").trim() || DEFAULT_CLINICAL_SUMMARY,
        riskFlags: normalizeRiskFlags(result.riskFlags),
        reportTypeRaw: String(result.reportType || "Medical Report").trim()
    };
}

async function generateTimelineEntry(reportText) {
    const normalizedText = String(reportText || "").trim();

    const prompt = `
You are a medical data interpreter. Analyze the medical report text and produce one clean timeline entry.
Only return the report date and bottom-line clinical conclusion.
Do not include raw lab tables, ranges, or verbose extracted text.

Return JSON with this exact shape:
{
  "date": "YYYY-MM-DD or Unknown",
  "conclusion": "string"
}

Report text:
${normalizedText.slice(0, 250000)}
`.trim();

    const result = await callAiJson(prompt);

    return {
        date: String(result.date || "Unknown").trim() || "Unknown",
        conclusion: String(result.conclusion || "").trim()
    };
}

module.exports = {
    generateMedicalSummary,
    generateTimelineEntry
};