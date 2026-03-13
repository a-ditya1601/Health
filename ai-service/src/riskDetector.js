function unique(values) {
    return Array.from(new Set(values));
}

const RISK_RULES = [
    {
        label: "Hypertensive risk",
        severity: "high",
        regex: /\b(hypertension|high blood pressure|bp\s*[:\-]?\s*(1[4-9]\d|[2-9]\d{2})\/\d{2,3})\b/i,
        reason: "The report contains hypertension language or an elevated blood pressure reading."
    },
    {
        label: "Diabetes risk",
        severity: "high",
        regex: /\b(diabetes|hba1c|hyperglycemia|glucose\s*[:\-]?\s*(1[8-9]\d|[2-9]\d{2}))\b/i,
        reason: "The report suggests diabetes or a concerning glucose marker."
    },
    {
        label: "Cardiac instability",
        severity: "critical",
        regex: /\b(chest pain|arrhythmia|tachycardia|heart failure|myocardial infarction|cardiomegaly)\b/i,
        reason: "The report references a potentially serious cardiovascular finding."
    },
    {
        label: "Respiratory compromise",
        severity: "high",
        regex: /\b(shortness of breath|hypoxia|copd|pneumonia|wheezing|oxygen saturation\s*[:\-]?\s*[78]\d)\b/i,
        reason: "The report includes respiratory findings that may need prompt attention."
    },
    {
        label: "Renal concern",
        severity: "high",
        regex: /\b(kidney disease|renal failure|dialysis|creatinine|proteinuria)\b/i,
        reason: "The report mentions kidney dysfunction indicators."
    },
    {
        label: "Neurologic concern",
        severity: "critical",
        regex: /\b(stroke|seizure|hemorrhage|altered mental status|brain lesion)\b/i,
        reason: "The report includes neurologic findings that may be urgent."
    },
    {
        label: "Oncology concern",
        severity: "critical",
        regex: /\b(cancer|malignancy|mass|tumor|metastatic|lesion)\b/i,
        reason: "The report references a possible malignant or suspicious lesion."
    },
    {
        label: "Infection or sepsis risk",
        severity: "high",
        regex: /\b(sepsis|infection|fever|bacteremia|cellulitis|abscess)\b/i,
        reason: "The report contains wording consistent with an active infection."
    }
];

function detectRiskFlags(text, extracted = {}) {
    const input = String(text || "");
    const lowerConditions = (extracted.conditions || []).map((item) => item.toLowerCase());
    const lowerMedications = (extracted.medications || []).map((item) => item.toLowerCase());
    const matches = [];

    for (const rule of RISK_RULES) {
        if (rule.regex.test(input)) {
            matches.push({
                label: rule.label,
                severity: rule.severity,
                reason: rule.reason
            });
        }
    }

    if (lowerConditions.includes("heart failure")) {
        matches.push({
            label: "Chronic cardiac disease",
            severity: "high",
            reason: "Known heart failure increases longitudinal cardiovascular risk."
        });
    }

    if (lowerConditions.some((value) => value.includes("diabetes")) && lowerMedications.includes("insulin")) {
        matches.push({
            label: "Insulin-managed diabetes",
            severity: "medium",
            reason: "Insulin use may indicate closer glucose monitoring needs."
        });
    }

    return unique(
        matches.map((item) => JSON.stringify(item))
    ).map((item) => JSON.parse(item));
}

module.exports = {
    detectRiskFlags
};
