const blockchainService = require("../services/blockchainService");
const AccessLog = require("../../models/AccessLog");
const Doctor = require("../../models/Doctor");
const {
    ensureWalletMatch,
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
        const { patientAddress, doctorAddress, durationInSeconds, reason } = req.body;
        const permission = await blockchainService.grantDoctorAccess({
            patientAddress,
            doctorAddress,
            durationInSeconds,
            reason
        });

        return res.status(200).json({
            success: true,
            message: "Doctor access granted",
            data: permission
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function revokeDoctorAccess(req, res) {
    try {
        const { patientAddress, doctorAddress } = req.body;
        const result = await blockchainService.revokeDoctorAccess({
            patientAddress,
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
    grantEmergencyAccess,
    getConsentLogs,
    getPatientRecords,
    getAccessRequests,
    getAccessAnalytics
};
