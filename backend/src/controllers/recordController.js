const blockchainService = require("../services/blockchainService");
const encryptionService = require("../services/encryptionService");
const ipfsService = require("../services/ipfsService");
const aiSummaryService = require("../services/aiSummaryService");
const AccessLog = require("../../models/AccessLog");
const Counter = require("../../models/Counter");
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
        const aiSummary = await aiSummaryService.generateSummary({
            text: extractedText,
            fileName: file.originalname,
            recordType
        });
        const timelineEvents = Array.isArray(aiSummary.timelineEvents)
            ? aiSummary.timelineEvents
            : Array.isArray(aiSummary.timeline)
              ? aiSummary.timeline
              : [];

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

        return res.status(201).json({
            success: true,
            message: "Medical record uploaded successfully",
            data: {
                record,
                storage: ipfsUpload,
                encryption: {
                    ...encryptionMetadata,
                    accessKeyEnvelope
                },
                aiSummary
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

module.exports = {
    uploadMedicalRecord,
    getPatientRecords,
    getDoctorRecords,
    getRecordById
};
