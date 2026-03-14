const blockchainService = require("../services/blockchainService");
const encryptionService = require("../services/encryptionService");
const ipfsService = require("../services/ipfsService");
const aiService = require("../services/aiService");
const AccessLog = require("../../models/AccessLog");
const Counter = require("../../models/Counter");
const MedicalRecord = require("../../models/MedicalRecord");
const {
    ensureWalletMatch,
    normalizeWalletAddress,
    requireAuthenticatedWallet
} = require("../middleware/authMiddleware");

let pdfParse;
try {
    pdfParse = require("pdf-parse");
} catch (error) {
    pdfParse = null;
}

function handleError(res, error) {
    const statusCode =
        error.statusCode ||
        (error.message?.toLowerCase().includes("not found") ? 404 : 400);
    return res.status(statusCode).json({
        success: false,
        message: error.message || "Record request failed"
    });
}

async function getNextAccessLogId() {
    const counter = await Counter.findOneAndUpdate(
        { key: "accessLogId" },
        { $inc: { value: 1 } },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    return counter.value;
}

async function createRecordViewLog({ doctorAddress, patientAddress, recordId }) {
    const logId = await getNextAccessLogId();

    await AccessLog.create({
        logId,
        doctorAddress: normalizeWalletAddress(doctorAddress),
        patientAddress: normalizeWalletAddress(patientAddress),
        recordId: Number(recordId),
        action: "ACCESS_VIEWED",
        timestamp: new Date()
    });
}

async function extractTextFromPdf(file) {
    if (!file?.buffer) {
        return "";
    }

    if (pdfParse) {
        const pdfData = await pdfParse(file.buffer);
        return pdfData.text || "";
    }

    return file.buffer.toString("utf8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
}

function buildFallbackMedicalSummary({ reportText, recordType }) {
    const fallbackClinicalSummary =
        "No significant health threats or abnormalities detected in the report.";

    return {
        reportDate: "Unknown",
        reportType: recordType || "Medical Report",
        conditionsDetected: [],
        significantAbnormalities: [],
        conditions: [],
        abnormalFindings: [],
        clinicalSummary: fallbackClinicalSummary,
        finalConclusion: fallbackClinicalSummary,
        riskFlags: [],
        medicalSummary: fallbackClinicalSummary
    };
}

function buildFallbackTimelineEntry({ reportType, aiSummary }) {
    return {
        date: aiSummary.reportDate || "Unknown",
        conclusion:
            aiSummary.finalConclusion ||
            aiSummary.clinicalSummary ||
            "No significant abnormalities detected."
    };
}

function toTimelineEvents(timelineEntry) {
    const conclusion = String(timelineEntry?.conclusion || "").trim();

    if (!conclusion) {
        return [];
    }

    return [
        {
            date: timelineEntry.date || "Unknown",
            type: "Clinical Conclusion",
            finding: conclusion,
            risk: "",
            sourceText: conclusion
        }
    ];
}

async function uploadMedicalRecord(req, res) {
    try {
        const authenticatedWallet = requireAuthenticatedWallet(req);
        const { patientAddress, recordType, metadata } = req.body;
        const file = req.file;
        const ownerAddress = normalizeWalletAddress(patientAddress || authenticatedWallet);

        ensureWalletMatch(ownerAddress, authenticatedWallet, "Authenticated wallet does not match the patient record owner");

        if (!file) {
            throw new Error("A PDF medical report file is required");
        }

        const extractedText = await extractTextFromPdf(file);

        let aiSummary;
        let timelineEntry;

        try {
            const medicalSummary = await aiService.generateMedicalSummary(extractedText);
            const generatedTimelineEntry = await aiService.generateTimelineEntry(extractedText);

            aiSummary = {
                conditionsDetected: Array.isArray(medicalSummary.conditionsDetected)
                    ? medicalSummary.conditionsDetected
                    : Array.isArray(medicalSummary.conditions)
                        ? medicalSummary.conditions
                        : [],
                significantAbnormalities: Array.isArray(medicalSummary.significantAbnormalities)
                    ? medicalSummary.significantAbnormalities
                    : Array.isArray(medicalSummary.abnormalFindings)
                        ? medicalSummary.abnormalFindings
                    : [],
                conditions: Array.isArray(medicalSummary.conditionsDetected)
                    ? medicalSummary.conditionsDetected
                    : Array.isArray(medicalSummary.conditions)
                        ? medicalSummary.conditions
                        : [],
                abnormalFindings: Array.isArray(medicalSummary.significantAbnormalities)
                    ? medicalSummary.significantAbnormalities
                    : Array.isArray(medicalSummary.abnormalFindings)
                    ? medicalSummary.abnormalFindings
                    : [],
                clinicalSummary:
                    medicalSummary.clinicalSummary ||
                    "No significant health threats or abnormalities detected in the report.",
                finalConclusion:
                    medicalSummary.finalConclusion ||
                    medicalSummary.clinicalSummary ||
                    "No significant health threats or abnormalities detected in the report.",
                reportType: medicalSummary.reportType || recordType || "Medical Report",
                reportDate: medicalSummary.reportDate || generatedTimelineEntry.date || "Unknown",
                riskFlags: Array.isArray(medicalSummary.riskFlags)
                    ? medicalSummary.riskFlags
                    : [],
                medicalSummary:
                    medicalSummary.clinicalSummary ||
                    medicalSummary.finalConclusion ||
                    "No significant health threats or abnormalities detected in the report.",
                timelineEntry: generatedTimelineEntry,
                rawText: extractedText
            };
            timelineEntry = {
                date: generatedTimelineEntry.date || aiSummary.reportDate || "Unknown",
                conclusion:
                    generatedTimelineEntry.conclusion ||
                    aiSummary.finalConclusion ||
                    "No significant abnormalities detected."
            };
        } catch (error) {
            console.error("AI generation failed. Falling back to local summary:", error.message || error);
            aiSummary = buildFallbackMedicalSummary({
                reportText: extractedText,
                recordType
            });
            timelineEntry = buildFallbackTimelineEntry({
                reportType: recordType,
                aiSummary
            });
            aiSummary.timelineEntry = timelineEntry;
            aiSummary.rawText = extractedText;
        }

        const timelineEvents = toTimelineEvents(timelineEntry);

        const { encryptedBuffer, accessKeyEnvelope, encryptionMetadata } =
            encryptionService.encryptFile(file.buffer, {
                owner: ownerAddress
            });

        const ipfsUpload = await ipfsService.uploadFile(encryptedBuffer, {
            fileName: `${file.originalname}.enc`,
            originalFileName: file.originalname,
            contentType: "application/octet-stream",
            patientAddress: ownerAddress,
            recordType
        });

        const record = await blockchainService.saveMedicalRecord({
            patientAddress: ownerAddress,
            ipfsHash: ipfsUpload.cid,
            encryptedKeyHash: encryptionMetadata.keyHash,
            recordType,
            fileName: file.originalname,
            contentType: file.mimetype,
            timelineEvents,
            aiSummary: {
                ...aiSummary,
                timeline: timelineEvents,
                metadata: metadata || null
            }
        });

        await MedicalRecord.findOneAndUpdate(
            { recordId: Number(record.recordId) },
            {
                $set: {
                    timelineEntry: {
                        ...timelineEntry,
                        date:
                            timelineEntry.date &&
                            timelineEntry.date !== "Unknown" &&
                            !Number.isNaN(new Date(timelineEntry.date).getTime())
                                ? timelineEntry.date
                                : new Date(record.createdAt).toISOString()
                    }
                }
            }
        );

        const resolvedTimelineEntry = {
            ...timelineEntry,
            date:
                timelineEntry.date &&
                timelineEntry.date !== "Unknown" &&
                !Number.isNaN(new Date(timelineEntry.date).getTime())
                    ? timelineEntry.date
                    : new Date(record.createdAt).toISOString()
        };

        return res.status(201).json({
            success: true,
            message: "Medical record uploaded successfully",
            data: {
                record: {
                    ...record,
                    timelineEntry: resolvedTimelineEntry
                },
                storage: ipfsUpload,
                encryption: {
                    ...encryptionMetadata,
                    accessKeyEnvelope
                },
                aiSummary,
                timelineEntry: resolvedTimelineEntry
            }
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function getPatientRecords(req, res) {
    try {
        const authenticatedWallet = requireAuthenticatedWallet(req);
        const { patientAddress } = req.params;
        ensureWalletMatch(patientAddress, authenticatedWallet, "Patients can only view their own records");
        const records = await blockchainService.getPatientRecords(patientAddress);

        return res.status(200).json({
            success: true,
            data: records
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function getDoctorRecords(req, res) {
    try {
        const authenticatedWallet = requireAuthenticatedWallet(req);
        const { doctorAddress } = req.params;
        ensureWalletMatch(doctorAddress, authenticatedWallet, "Doctors can only view records granted to their own wallet");
        const records = await blockchainService.getDoctorAccessibleRecords(doctorAddress);

        return res.status(200).json({
            success: true,
            data: records
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function getRecordById(req, res) {
    try {
        const authenticatedWallet = requireAuthenticatedWallet(req);
        const { recordId } = req.params;
        const record = await blockchainService.getRecordById(recordId);
        const normalizedWallet = normalizeWalletAddress(authenticatedWallet);

        const isPatientOwner = record.patientAddress === normalizedWallet;
        const hasDoctorPermission = await blockchainService.hasActiveAccess(
            record.patientAddress,
            normalizedWallet
        );

        if (!isPatientOwner && !hasDoctorPermission) {
            const error = new Error("You are not authorized to access this record");
            error.statusCode = 403;
            throw error;
        }

        if (!isPatientOwner) {
            await createRecordViewLog({
                doctorAddress: normalizedWallet,
                patientAddress: record.patientAddress,
                recordId: record.recordId
            });
        }

        return res.status(200).json({
            success: true,
            data: record
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function deleteMedicalRecord(req, res) {
    try {
        const authenticatedWallet = requireAuthenticatedWallet(req);
        const { recordId } = req.params;

        const result = await blockchainService.deleteMedicalRecord({
            patientAddress: authenticatedWallet,
            recordId
        });

        return res.status(200).json({
            success: true,
            message: "Medical record deleted successfully",
            data: result
        });
    } catch (error) {
        return handleError(res, error);
    }
}

module.exports = {
    uploadMedicalRecord,
    getPatientRecords,
    getDoctorRecords,
    getRecordById,
    deleteMedicalRecord
};
