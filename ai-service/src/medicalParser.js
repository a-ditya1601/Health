const CONDITION_PATTERNS = [
    "diabetes",
    "type 1 diabetes",
    "type 2 diabetes",
    "hypertension",
    "hypotension",
    "asthma",
    "copd",
    "pneumonia",
    "bronchitis",
    "covid-19",
    "anemia",
    "arthritis",
    "osteoporosis",
    "stroke",
    "heart failure",
    "coronary artery disease",
    "arrhythmia",
    "tachycardia",
    "bradycardia",
    "chronic kidney disease",
    "renal failure",
    "kidney disease",
    "liver disease",
    "cirrhosis",
    "thyroid disorder",
    "hypothyroidism",
    "hyperthyroidism",
    "cancer",
    "malignancy",
    "tumor",
    "migraine",
    "depression",
    "anxiety",
    "sepsis",
    "fracture",
    "obesity"
];

const MEDICATION_PATTERNS = [
    "metformin",
    "insulin",
    "lisinopril",
    "losartan",
    "amlodipine",
    "atorvastatin",
    "simvastatin",
    "aspirin",
    "warfarin",
    "clopidogrel",
    "omeprazole",
    "pantoprazole",
    "albuterol",
    "salbutamol",
    "prednisone",
    "levothyroxine",
    "furosemide",
    "metoprolol",
    "amoxicillin",
    "azithromycin",
    "ibuprofen",
    "paracetamol",
    "acetaminophen",
    "gabapentin",
    "sertraline",
    "fluoxetine"
];

const REPORT_TYPE_RULES = [
    { type: "Blood Test", regex: /\b(?:blood test|cbc|hba1c|glucose|lipid|cholesterol|triglycerides|creatinine)\b/i },
    { type: "Radiology", regex: /\b(?:x-ray|xray|ct scan|mri|ultrasound|imaging|scan)\b/i },
    { type: "ECG", regex: /\b(?:ecg|ekg|electrocardiogram)\b/i },
    { type: "Discharge Summary", regex: /\b(?:discharge summary|discharge note)\b/i },
    { type: "Consultation", regex: /\b(?:consultation|clinical note|progress note|follow-up)\b/i }
];

const SECTION_KEYWORDS = {
    diagnosis: ["diagnosis", "final diagnosis", "impression", "assessment", "conclusion"],
    findings: ["findings", "key findings", "results", "investigation results", "observations"],
    recommendation: ["recommendation", "recommendations", "plan", "treatment plan", "advice", "follow-up", "follow up"],
    medication: ["medication", "medications", "prescription", "rx"],
    history: ["history", "history of present illness", "clinical history"]
};

function normalizeWhitespace(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
}

function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean).map((item) => item.trim())))
        .sort((a, b) => a.localeCompare(b));
}

function toTitleCase(value) {
    return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function sanitizeClinicalText(value) {
    return normalizeWhitespace(String(value || ""))
        .replace(/^(?:findings?|results?|diagnosis|conclusion|impression|recommendation|plan)\s*[:\-]\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

function formatDateOnly(value) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed.toISOString().slice(0, 10);
}

function parseEventDate(rawDate) {
    const normalized = normalizeWhitespace(rawDate).replace(/,/g, "");
    const parsed = new Date(normalized);

    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
    }

    return null;
}

function isPageLine(line) {
    return /^(?:page\s*\d+(?:\s*of\s*\d+)?|\d+\s*\/\s*\d+)$/i.test(line);
}

function isAdministrativeLine(line) {
    return /\b(?:hospital|medical center|department|laboratory|lab no|mrn|patient id|registration no|reg no|phone|fax|email|address|website|generated on)\b/i.test(line);
}

function hasClinicalSignal(line) {
    return /\b(?:diagnosis|impression|assessment|conclusion|finding|recommend|plan|follow-up|follow up|abnormal|elevated|low|high|positive|negative|glucose|hba1c|cholesterol|creatinine|hemoglobin|wbc|platelet|bp|blood pressure|mri|ct|x-ray|ultrasound)\b/i.test(line);
}

function isAbnormalResultLine(line) {
    return /\b(?:abnormal|critical|elevated|raised|decreased|reduced|outside reference|high|low|positive)\b/i.test(line)
        || /\b(?:h|l)\b\s*$/i.test(line)
        || /\b\d+(?:\.\d+)?\s*(?:mg\/dl|mmol\/l|g\/dl|%|iu\/l|u\/l)\b/i.test(line) && /\b(?:high|low|flag|abnormal)\b/i.test(line);
}

function isLikelyTableNoise(line) {
    if (!line) {
        return true;
    }

    const delimiterCount = (line.match(/[|\t]/g) || []).length;
    const hasManyPipes = delimiterCount >= 3;
    const manyColumns = line.split(/\s{2,}/).length >= 6;
    const mostlyCodes = /^[A-Z0-9\s\-\/%.:]+$/.test(line) && !hasClinicalSignal(line);

    return (hasManyPipes || manyColumns || mostlyCodes) && !isAbnormalResultLine(line);
}

function preprocessMedicalText(rawText) {
    const rawLines = String(rawText || "")
        .split(/\r?\n/)
        .map((line) => line.replace(/\u0000/g, " ").trim())
        .filter(Boolean);

    const counts = new Map();
    for (const line of rawLines) {
        const key = line.toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    const cleanedLines = [];

    for (const line of rawLines) {
        const normalizedLine = normalizeWhitespace(line);
        const key = normalizedLine.toLowerCase();

        if (normalizedLine.length <= 1 || isPageLine(normalizedLine)) {
            continue;
        }

        if (isLikelyTableNoise(normalizedLine)) {
            continue;
        }

        if (isAdministrativeLine(normalizedLine) && !hasClinicalSignal(normalizedLine) && normalizedLine.length <= 90) {
            continue;
        }

        if (counts.get(key) > 2 && isAdministrativeLine(normalizedLine) && !hasClinicalSignal(normalizedLine)) {
            continue;
        }

        cleanedLines.push(normalizedLine);
    }

    return cleanedLines.join("\n");
}

function detectSectionKey(heading) {
    const normalized = normalizeWhitespace(heading).toLowerCase().replace(/[:\-]$/, "");

    for (const [key, keywords] of Object.entries(SECTION_KEYWORDS)) {
        if (keywords.some((keyword) => normalized.includes(keyword))) {
            return key;
        }
    }

    return null;
}

function extractSections(cleanedText) {
    const sections = {
        body: []
    };

    const lines = String(cleanedText || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    let currentSection = "body";

    for (const line of lines) {
        const inlineHeadingMatch = line.match(/^([A-Za-z][A-Za-z\s\-/()&]{2,50})\s*[:\-]\s*(.+)$/);
        if (inlineHeadingMatch) {
            const detected = detectSectionKey(inlineHeadingMatch[1]);
            if (detected) {
                currentSection = detected;
                sections[currentSection] = sections[currentSection] || [];
                sections[currentSection].push(inlineHeadingMatch[2].trim());
                continue;
            }
        }

        const headingOnlyMatch = line.match(/^([A-Za-z][A-Za-z\s\-/()&]{2,50})\s*:?$/);
        if (headingOnlyMatch) {
            const detected = detectSectionKey(headingOnlyMatch[1]);
            if (detected) {
                currentSection = detected;
                sections[currentSection] = sections[currentSection] || [];
                continue;
            }
        }

        sections[currentSection] = sections[currentSection] || [];
        sections[currentSection].push(line);
    }

    return sections;
}

function sectionText(sections, keys) {
    return keys
        .flatMap((key) => sections[key] || [])
        .join(" ")
        .trim();
}

function splitPhrases(text) {
    const lines = String(text || "")
        .split(/\r?\n/)
        .map((line) => normalizeWhitespace(line))
        .filter(Boolean);

    return lines
        .flatMap((line) =>
            line
                .split(/(?<=[.!?])\s+/)
                .map((item) => normalizeWhitespace(item))
                .filter(Boolean)
        )
        .map((item) => sanitizeClinicalText(item))
        .filter((item) => item.length >= 8 && item.length <= 260);
}

function findReportDate(text) {
    const labeledDateMatch = String(text || "").match(/\b(?:date|report date|collected on|exam date)\s*[:\-]\s*([^\n]+)/i);
    if (labeledDateMatch) {
        const raw = labeledDateMatch[1].match(/((?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|(?:\d{4}[\/-]\d{1,2}[\/-]\d{1,2})|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i);
        const parsed = raw ? parseEventDate(raw[1]) : null;
        if (parsed) {
            return formatDateOnly(parsed);
        }
    }

    const genericDateMatch = String(text || "").match(/\b((?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|(?:\d{4}[\/-]\d{1,2}[\/-]\d{1,2})|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i);
    if (genericDateMatch) {
        const parsed = parseEventDate(genericDateMatch[1]);
        return formatDateOnly(parsed);
    }

    return "Unknown";
}

function detectReportType(text, options = {}) {
    const explicitType = normalizeWhitespace(options.reportType || "");
    if (explicitType && explicitType.toLowerCase() !== "medical-report") {
        return explicitType;
    }

    const searchText = `${text || ""} ${options.fileName || ""}`;
    const matched = REPORT_TYPE_RULES.find((rule) => rule.regex.test(searchText));
    return matched ? matched.type : "Medical Report";
}

function detectConditions(text) {
    const lowerText = String(text || "").toLowerCase();
    const matches = CONDITION_PATTERNS.filter((condition) => lowerText.includes(condition))
        .map((condition) => toTitleCase(condition));

    const diagnosisMatches = Array.from(
        String(text || "").matchAll(/\b(?:diagnosis|diagnoses|history of|impression|assessment|conclusion)\s*[:\-]\s*([^.\n]+)/gi)
    )
        .flatMap((match) => match[1].split(/,|;|\band\b/gi))
        .map((item) => normalizeWhitespace(item))
        .filter((item) => item.length > 2)
        .map((item) => toTitleCase(item));

    return uniqueSorted([...matches, ...diagnosisMatches]);
}

function detectMedications(text) {
    const lowerText = String(text || "").toLowerCase();
    const matches = MEDICATION_PATTERNS.filter((medication) => lowerText.includes(medication))
        .map((medication) => toTitleCase(medication));

    const medicationLines = Array.from(
        String(text || "").matchAll(/\b(?:medications?|rx|prescribed)\s*[:\-]\s*([^.\n]+)/gi)
    )
        .flatMap((match) => match[1].split(/,|;|\band\b/gi))
        .map((item) => normalizeWhitespace(item))
        .filter((item) => item.length > 1)
        .map((item) => toTitleCase(item));

    return uniqueSorted([...matches, ...medicationLines]);
}

function extractAbnormalResults(cleanedText) {
    const lines = String(cleanedText || "")
        .split(/\r?\n/)
        .map((line) => normalizeWhitespace(line))
        .filter(Boolean);

    const abnormalLines = lines
        .filter((line) => isAbnormalResultLine(line) && hasClinicalSignal(line))
        .map((line) => sanitizeClinicalText(line).slice(0, 220));

    const unique = new Map();
    for (const line of abnormalLines) {
        const key = line.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (!unique.has(key)) {
            unique.set(key, line);
        }
    }

    return Array.from(unique.values()).slice(0, 6);
}

function extractKeyFindings(sections, cleanedText) {
    const primaryFindings = sectionText(sections, ["findings"]);
    const secondaryFindings = primaryFindings ? "" : sectionText(sections, ["history", "body"]);
    const phrases = splitPhrases(primaryFindings || secondaryFindings).slice(0, 5);
    const abnormal = extractAbnormalResults(cleanedText);

    const candidates = uniqueSorted([...abnormal, ...phrases]);
    const findings = candidates.filter((item, index) => {
        const normalized = item.toLowerCase();
        return !candidates.some((other, otherIndex) =>
            otherIndex !== index &&
            other.length > item.length &&
            other.toLowerCase().includes(normalized)
        );
    }).slice(0, 5);

    if (findings.length) {
        return findings.join("; ");
    }

    return "Key clinical findings were not explicitly stated in the extracted text.";
}

function extractDiagnosisConclusion(sections, conditions = []) {
    const diagnosisText = sectionText(sections, ["diagnosis"]);
    const diagnosisPhrases = splitPhrases(diagnosisText).slice(0, 3);

    if (diagnosisPhrases.length) {
        return diagnosisPhrases.join("; ");
    }

    if (conditions.length) {
        return `Possible diagnosis context: ${conditions.slice(0, 3).join(", ")}.`;
    }

    return "Diagnosis or conclusion was not explicitly identified.";
}

function extractFollowUp(sections, cleanedText) {
    const followUpText = sectionText(sections, ["recommendation"]);
    const followUpPhrases = splitPhrases(followUpText).slice(0, 3);

    if (followUpPhrases.length) {
        return followUpPhrases.join("; ");
    }

    const fallbackMatch = normalizeWhitespace(cleanedText).match(/\b(?:follow-up|follow up|recommend(?:ed|ation)?|advise(?:d)?|plan)\b[^.]*\.?/i);
    return fallbackMatch ? fallbackMatch[0].slice(0, 240) : "";
}

function dedupeMedicalEvents(events) {
    const uniqueEvents = new Map();

    for (const event of events) {
        if (!event || !event.finding) {
            continue;
        }

        const key = `${event.date}|${event.type}|${event.finding}`;
        if (!uniqueEvents.has(key)) {
            uniqueEvents.set(key, {
                date: event.date || "Unknown",
                type: event.type || "Clinical Note",
                finding: normalizeWhitespace(event.finding).slice(0, 220),
                risk: normalizeWhitespace(event.risk || "").slice(0, 180),
                sourceText: normalizeWhitespace(event.sourceText || event.finding).slice(0, 280)
            });
        }
    }

    return Array.from(uniqueEvents.values());
}

function sortMedicalEvents(events) {
    return [...events].sort((a, b) => {
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

function detectMedicalEvents(text, detectedConditions = [], options = {}) {
    const cleanedText = preprocessMedicalText(text);
    const sections = extractSections(cleanedText);
    const reportDate = findReportDate(cleanedText);
    const keyFindings = extractKeyFindings(sections, cleanedText);
    const diagnosis = extractDiagnosisConclusion(sections, detectedConditions);
    const recommendedFollowUp = extractFollowUp(sections, cleanedText);

    const events = [
        {
            date: reportDate,
            type: "Key Findings",
            finding: keyFindings,
            risk: "",
            sourceText: keyFindings
        },
        {
            date: reportDate,
            type: "Diagnosis",
            finding: diagnosis,
            risk: "",
            sourceText: diagnosis
        }
    ];

    if (recommendedFollowUp) {
        events.push({
            date: reportDate,
            type: "Follow-up",
            finding: recommendedFollowUp,
            risk: "Follow-up advised",
            sourceText: recommendedFollowUp
        });
    }

    for (const abnormal of extractAbnormalResults(cleanedText)) {
        events.push({
            date: reportDate,
            type: "Abnormal Result",
            finding: abnormal,
            risk: "Abnormal clinical marker",
            sourceText: abnormal
        });
    }

    return sortMedicalEvents(dedupeMedicalEvents(events)).slice(0, 20);
}

function parseMedicalData(text, options = {}) {
    const cleanedText = preprocessMedicalText(text);
    const normalizedText = normalizeWhitespace(cleanedText);
    const sections = extractSections(cleanedText);
    const conditions = detectConditions(normalizedText);
    const medications = detectMedications(normalizedText);
    const reportDate = findReportDate(cleanedText);
    const reportType = detectReportType(cleanedText, options);
    const keyFindings = extractKeyFindings(sections, cleanedText);
    const diagnosis = extractDiagnosisConclusion(sections, conditions);
    const recommendedFollowUp = extractFollowUp(sections, cleanedText);
    const abnormalResults = extractAbnormalResults(cleanedText);

    return {
        cleanedText,
        reportDate,
        reportType,
        keyFindings,
        diagnosis,
        recommendedFollowUp,
        abnormalResults,
        conditions,
        medications,
        medicalEvents: detectMedicalEvents(cleanedText, conditions, options)
    };
}

module.exports = {
    parseMedicalData,
    detectConditions,
    detectMedications,
    detectMedicalEvents,
    preprocessMedicalText,
    normalizeWhitespace
};
