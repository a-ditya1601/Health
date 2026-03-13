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

const TEST_RESULT_PATTERNS = [
    {
        type: "Blood Test",
        regex: /\b(?:cbc|complete blood count|hemoglobin|wbc|platelets|hba1c|glucose|cholesterol|triglycerides|ige|crp|creatinine)\b/i
    },
    {
        type: "Imaging",
        regex: /\b(?:x-ray|xray|ct scan|mri|ultrasound|imaging|scan|echocardiogram|echo)\b/i
    },
    {
        type: "Vital Sign",
        regex: /\b(?:blood pressure|bp|heart rate|pulse|oxygen saturation|spo2|temperature)\b/i
    }
];

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

function detectConditions(text) {
    const lowerText = text.toLowerCase();
    const matches = CONDITION_PATTERNS.filter((condition) => lowerText.includes(condition))
        .map((condition) => toTitleCase(condition));

    const diagnosisMatches = Array.from(
        text.matchAll(
            /\b(?:diagnosis|diagnoses|history of|impression|assessment)\s*[:\-]\s*([^.:\n]+)/gi
        )
    )
        .flatMap((match) => match[1].split(/,|;|\band\b/gi))
        .map((item) => normalizeWhitespace(item))
        .filter((item) => item.length > 2)
        .map((item) => toTitleCase(item));

    return uniqueSorted([...matches, ...diagnosisMatches]);
}

function detectMedications(text) {
    const lowerText = text.toLowerCase();
    const matches = MEDICATION_PATTERNS.filter((medication) => lowerText.includes(medication))
        .map((medication) => toTitleCase(medication));

    const medicationLines = Array.from(
        text.matchAll(/\b(?:medications?|rx|prescribed)\s*[:\-]\s*([^.:\n]+)/gi)
    )
        .flatMap((match) => match[1].split(/,|;|\band\b/gi))
        .map((item) => normalizeWhitespace(item))
        .filter((item) => item.length > 1)
        .map((item) => toTitleCase(item));

    return uniqueSorted([...matches, ...medicationLines]);
}

function parseEventDate(rawDate) {
    const normalized = normalizeWhitespace(rawDate).replace(/,/g, "");
    const parsed = new Date(normalized);

    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
    }

    return null;
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

function inferEventType(line) {
    const normalizedLine = normalizeWhitespace(line);

    if (/\b(?:diagnosis|diagnosed|assessment|impression|history of)\b/i.test(normalizedLine)) {
        return "Diagnosis";
    }

    if (/\b(?:medications?|rx|prescribed|started on|continue|continue taking)\b/i.test(normalizedLine)) {
        return "Medication";
    }

    const matchedTest = TEST_RESULT_PATTERNS.find((pattern) => pattern.regex.test(normalizedLine));
    if (matchedTest) {
        return matchedTest.type;
    }

    if (/\b(?:procedure|surgery|operation)\b/i.test(normalizedLine)) {
        return "Procedure";
    }

    if (/\b(?:visit|follow-up|follow up|consultation|exam)\b/i.test(normalizedLine)) {
        return "Clinical Visit";
    }

    return "Clinical Note";
}

function inferFinding(line, eventType) {
    const normalizedLine = normalizeWhitespace(line);

    if (eventType === "Diagnosis") {
        const diagnosisMatch = normalizedLine.match(
            /\b(?:diagnosis|diagnosed with|assessment|impression|history of)\s*[:\-]?\s*(.+)$/i
        );
        if (diagnosisMatch) {
            return diagnosisMatch[1].slice(0, 220);
        }
    }

    if (eventType === "Medication") {
        const medicationMatch = normalizedLine.match(
            /\b(?:medications?|rx|prescribed|started on|continue taking|continue)\s*[:\-]?\s*(.+)$/i
        );
        if (medicationMatch) {
            return medicationMatch[1].slice(0, 220);
        }
    }

    if (eventType === "Blood Test" || eventType === "Imaging" || eventType === "Vital Sign") {
        const resultMatch = normalizedLine.match(
            /\b(?:result|results|finding|findings|shows|showed|revealed|noted)\s*[:\-]?\s*(.+)$/i
        );
        if (resultMatch) {
            return resultMatch[1].slice(0, 220);
        }
    }

    return normalizedLine.slice(0, 220);
}

function inferRisk(line, detectedConditions = []) {
    const normalizedLine = normalizeWhitespace(line);
    const lowerLine = normalizedLine.toLowerCase();
    const matchedCondition = detectedConditions.find((condition) =>
        lowerLine.includes(condition.toLowerCase())
    );

    if (/\b(?:high|elevated|abnormal|critical|positive)\b/i.test(normalizedLine)) {
        return matchedCondition ? `${matchedCondition} follow-up recommended` : "Clinical follow-up recommended";
    }

    if (/\b(?:low|reduced|decreased)\b/i.test(normalizedLine)) {
        return matchedCondition ? `${matchedCondition} monitoring recommended` : "Monitoring recommended";
    }

    if (matchedCondition) {
        return `${matchedCondition} management`;
    }

    return "";
}

function toStructuredMedicalEvent(line, detectedConditions = []) {
    const normalizedLine = normalizeWhitespace(line);
    const dateMatch = normalizedLine.match(
        /\b((?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|(?:\d{4}[\/-]\d{1,2}[\/-]\d{1,2})|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i
    );
    const isoDate = dateMatch ? parseEventDate(dateMatch[0]) : null;
    const eventType = inferEventType(normalizedLine);

    return {
        date: formatDateOnly(isoDate) || "Unknown",
        type: eventType,
        finding: inferFinding(normalizedLine, eventType),
        risk: inferRisk(normalizedLine, detectedConditions),
        sourceText: normalizedLine.slice(0, 280)
    };
}

function dedupeMedicalEvents(events) {
    const uniqueEvents = new Map();

    for (const event of events) {
        const key = `${event.date}|${event.type}|${event.finding}`;
        if (!uniqueEvents.has(key)) {
            uniqueEvents.set(key, event);
        }
    }

    return Array.from(uniqueEvents.values());
}

function detectMedicalEvents(text, detectedConditions = []) {
    const lines = String(text || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const dateRegex =
        /\b((?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|(?:\d{4}[\/-]\d{1,2}[\/-]\d{1,2})|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i;
    const eventKeywordRegex =
        /\b(admitted|discharged|diagnosed|treated|surgery|procedure|follow-up|follow up|prescribed|reported|exam|scan|imaging|consultation|visit)\b/i;
    const structuredEventRegex =
        /\b(?:diagnosis|diagnosed|assessment|impression|history of|medications?|rx|prescribed|hba1c|glucose|ige|cholesterol|creatinine|cbc|blood pressure|bp|x-ray|xray|ct scan|mri|ultrasound)\b/i;

    const events = [];

    for (const line of lines) {
        const dateMatch = line.match(dateRegex);
        const looksStructured = structuredEventRegex.test(line);

        if (!dateMatch && !looksStructured) {
            continue;
        }

        if (!dateMatch && !eventKeywordRegex.test(line) && !looksStructured && line.length < 12) {
            continue;
        }

        events.push(toStructuredMedicalEvent(line, detectedConditions));
    }

    return dedupeMedicalEvents(events)
        .sort((a, b) => {
            if (a.date !== "Unknown" && b.date !== "Unknown") {
                return new Date(a.date) - new Date(b.date);
            }
            return a.date.localeCompare(b.date);
        })
        .slice(0, 20);
}

function parseMedicalData(text) {
    const normalizedText = normalizeWhitespace(text);
    const conditions = detectConditions(normalizedText);
    const medications = detectMedications(normalizedText);

    return {
        conditions,
        medications,
        medicalEvents: detectMedicalEvents(text, conditions)
    };
}

module.exports = {
    parseMedicalData,
    detectConditions,
    detectMedications,
    detectMedicalEvents,
    normalizeWhitespace
};
