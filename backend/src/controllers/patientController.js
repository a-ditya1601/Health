const crypto = require("crypto");
const blockchainService = require("../services/blockchainService");
const AccessLog = require("../../models/AccessLog");
const Doctor = require("../../models/Doctor");
const MedicalRecord = require("../../models/MedicalRecord");
const {
    ensureWalletMatch,
    normalizeWalletAddress,
    requireAuthenticatedWallet
} = require("../middleware/authMiddleware");

function handleError(res, error) {
    const statusCode =
        error.statusCode ||
        (error.message?.toLowerCase().includes("not found") ? 404 : 400);
    return res.status(statusCode).json({
        success: false,
        message: error.message || "Patient request failed"
    });
}

function resolveDoctorName(doctor) {
    if (!doctor) {
        return "Unknown Doctor";
    }

    if (!doctor.metadataURI) {
        return doctor.walletAddress;
    }

    try {
        const parsed = JSON.parse(doctor.metadataURI);
        return parsed.name || parsed.doctorName || doctor.metadataURI;
    } catch (error) {
        return doctor.metadataURI;
    }
}

function generateAccessKey() {
    const first = Math.random().toString(36).slice(2, 6).toUpperCase();
    const second = Math.random().toString(36).slice(2, 6).toUpperCase();
    const third = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${first}-${second}-${third}`;
}

function computeAccessKeyHash(accessKey) {
    return crypto.createHash("sha256").update(String(accessKey).trim()).digest("hex");
}

function resolveDurationInSeconds(durationInSeconds, duration) {
    const candidate = Number(durationInSeconds ?? duration ?? 86400);
    if (!Number.isFinite(candidate) || candidate <= 0) {
        const error = new Error("A positive access duration is required");
        error.statusCode = 400;
        throw error;
    }

    return candidate;
}

async function registerPatient(req, res) {
    try {
        const { patientAddress, walletAddress, metadataURI } = req.body;
        const patient = await blockchainService.registerPatient({
            patientAddress: patientAddress || walletAddress,
            metadataURI
        });

        return res.status(201).json({
            success: true,
            message: "Patient registered successfully",
            data: patient
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function grantDoctorAccess(req, res) {
    try {
        const authenticatedWallet = requireAuthenticatedWallet(req);
        const { patientAddress, doctorAddress, durationInSeconds, duration, reason } = req.body;
        const resolvedPatientAddress = patientAddress || authenticatedWallet;

        ensureWalletMatch(
            resolvedPatientAddress,
            authenticatedWallet,
            "Patients can only grant access for their own wallet"
        );

        const resolvedDuration = resolveDurationInSeconds(durationInSeconds, duration);
        const permission = await blockchainService.grantDoctorAccess({
            patientAddress: resolvedPatientAddress,
            doctorAddress,
            durationInSeconds: resolvedDuration,
            reason
        });

        const accessKey = generateAccessKey();
        const accessKeyHash = computeAccessKeyHash(accessKey);
        const normalizedPatient = normalizeWalletAddress(resolvedPatientAddress);
        const normalizedDoctor = normalizeWalletAddress(doctorAddress);

        await MedicalRecord.updateMany(
            {
                patientAddress: normalizedPatient,
                isDeleted: { $ne: true }
            },
            {
                $set: {
                    encryptedKeyHash: accessKeyHash
                }
            }
        );

        await AccessLog.findOneAndUpdate(
            {
                patientAddress: normalizedPatient,
                doctorAddress: normalizedDoctor,
                action: "ACCESS_GRANTED"
            },
            {
                $set: {
                    "details.accessKeyHash": accessKeyHash,
                    "details.unlockMethod": "patient-shared-key"
                }
            },
            {
                sort: { timestamp: -1 }
            }
        );

        return res.status(200).json({
            success: true,
            message: "Doctor access granted",
            data: {
                ...permission,
                accessKey,
                accessKeyHash
            }
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function revokeDoctorAccess(req, res) {
    try {
        const authenticatedWallet = requireAuthenticatedWallet(req);
        const { patientAddress, doctorAddress } = req.body;
        const resolvedPatientAddress = patientAddress || authenticatedWallet;

        ensureWalletMatch(
            resolvedPatientAddress,
            authenticatedWallet,
            "Patients can only revoke access for their own wallet"
        );

        const result = await blockchainService.revokeDoctorAccess({
            patientAddress: resolvedPatientAddress,
            doctorAddress
        });

        return res.status(200).json({
            success: true,
            message: "Doctor access revoked",
            data: result
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function rejectAccessRequest(req, res) {
    try {
        const authenticatedWallet = requireAuthenticatedWallet(req);
        const { patientAddress, doctorAddress, reason } = req.body;
        const resolvedPatientAddress = patientAddress || authenticatedWallet;

        ensureWalletMatch(
            resolvedPatientAddress,
            authenticatedWallet,
            "Patients can only reject requests for their own wallet"
        );

        const normalizedPatient = normalizeWalletAddress(resolvedPatientAddress);
        const normalizedDoctor = normalizeWalletAddress(doctorAddress);

        if (!normalizedDoctor) {
            const error = new Error("Doctor wallet address is required");
            error.statusCode = 400;
            throw error;
        }

        const request = await AccessLog.findOne({
            patientAddress: normalizedPatient,
            doctorAddress: normalizedDoctor,
            action: "ACCESS_REQUESTED",
            status: "pending"
        }).sort({ timestamp: -1 });

        if (!request) {
            const error = new Error("Pending access request not found");
            error.statusCode = 404;
            throw error;
        }

        request.status = "rejected";
        request.respondedAt = new Date();
        request.details = {
            ...(request.details || {}),
            rejectionReason: reason || "Rejected by patient"
        };
        await request.save();

        return res.status(200).json({
            success: true,
            message: "Access request rejected",
            data: {
                requestId: request.requestId,
                patientAddress: request.patientAddress,
                doctorAddress: request.doctorAddress,
                status: request.status,
                respondedAt: request.respondedAt?.toISOString() || null,
                reason: request.details?.rejectionReason || "Rejected by patient"
            }
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function grantEmergencyAccess(req, res) {
    try {
        const { patientAddress, doctorAddress, durationInSeconds, reason } = req.body;
        const result = await blockchainService.grantEmergencyAccess({
            patientAddress,
            doctorAddress,
            durationInSeconds,
            reason
        });

        return res.status(200).json({
            success: true,
            message: "Emergency access granted",
            data: result
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function assignGuardian(req, res) {
    try {
        const authenticatedWallet = requireAuthenticatedWallet(req);
        const { patientAddress, guardianAddress } = req.body;
        const resolvedPatientAddress = patientAddress || authenticatedWallet;

        ensureWalletMatch(
            resolvedPatientAddress,
            authenticatedWallet,
            "Only the patient can assign a guardian."
        );

        if (!guardianAddress) {
            return res.status(400).json({ success: false, message: "A guardian wallet address is required." });
        }

        const normalizedPatient = normalizeWalletAddress(resolvedPatientAddress);
        const normalizedGuardian = normalizeWalletAddress(guardianAddress);

        const txHash = await blockchainService.assignGuardianByRelayer(normalizedPatient, normalizedGuardian);

        const PatientModel = require("../../models/Patient");
        await PatientModel.findOneAndUpdate(
            { walletAddress: normalizedPatient },
            { guardianWalletAddress: normalizedGuardian },
            { new: true, upsert: true }
        );

        await AccessLog.create({
            patientAddress: normalizedPatient,
            doctorAddress: normalizedGuardian,
            action: "GUARDIAN_ASSIGNED",
            details: `Guardian ${normalizedGuardian} has been assigned`,
            txHash
        });

        return res.status(200).json({
            success: true,
            message: "Guardian successfully assigned.",
            data: { guardianAddress: normalizedGuardian, txHash }
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function getConsentLogs(req, res) {
    try {
        const authenticatedWallet = requireAuthenticatedWallet(req);
        const { patientAddress } = req.params;
        ensureWalletMatch(patientAddress, authenticatedWallet, "Patients can only view their own consent logs");
        const logs = await blockchainService.getConsentLogs({ patientAddress });

        return res.status(200).json({
            success: true,
            data: logs
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

async function getAccessRequests(req, res) {
    try {
        const authenticatedWallet = requireAuthenticatedWallet(req);
        const { patientAddress } = req.params;
        ensureWalletMatch(patientAddress, authenticatedWallet, "Patients can only view their own access requests");
        const requests = await blockchainService.getAccessRequests(patientAddress);

        return res.status(200).json({
            success: true,
            data: requests
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function getAccessAnalytics(req, res) {
    try {
        const patientAddress = requireAuthenticatedWallet(req);
        const analytics = await AccessLog.aggregate([
            {
                $match: {
                    patientAddress,
                    doctorAddress: { $ne: null },
                    action: "ACCESS_VIEWED"
                }
            },
            {
                $group: {
                    _id: "$doctorAddress",
                    accessCount: { $sum: 1 },
                    lastAccessed: { $max: "$timestamp" }
                }
            },
            {
                $sort: {
                    lastAccessed: -1
                }
            }
        ]);

        const doctorAddresses = analytics.map((item) => item._id);
        const doctors = await Doctor.find({
            walletAddress: { $in: doctorAddresses }
        }).lean();
        const doctorMap = new Map(
            doctors.map((doctor) => [doctor.walletAddress, resolveDoctorName(doctor)])
        );

        return res.status(200).json({
            success: true,
            data: analytics.map((item) => ({
                doctorAddress: item._id,
                doctorName: doctorMap.get(item._id) || item._id,
                accessCount: item.accessCount,
                lastAccessed: item.lastAccessed?.toISOString() || null
            }))
        });
    } catch (error) {
        return handleError(res, error);
    }
}

module.exports = {
    registerPatient,
    grantDoctorAccess,
    revokeDoctorAccess,
    rejectAccessRequest,
    grantEmergencyAccess,
    getConsentLogs,
    getPatientRecords,
    getAccessRequests,
    getAccessAnalytics,
    assignGuardian
};
