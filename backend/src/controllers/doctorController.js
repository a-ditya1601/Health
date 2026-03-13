const blockchainService = require("../services/blockchainService");

function handleError(res, error) {
    const statusCode = error.message?.toLowerCase().includes("not found") ? 404 : 400;
    return res.status(statusCode).json({
        success: false,
        message: error.message || "Doctor request failed"
    });
}

async function registerDoctor(req, res) {
    try {
        const { doctorAddress, walletAddress, metadataURI } = req.body;
        const doctor = await blockchainService.registerDoctor({
            doctorAddress: doctorAddress || walletAddress,
            metadataURI
        });

        return res.status(201).json({
            success: true,
            message: "Doctor registered successfully",
            data: doctor
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function requestAccess(req, res) {
    try {
        const { patientAddress, doctorAddress, reason } = req.body;
        const request = await blockchainService.createAccessRequest({
            patientAddress,
            doctorAddress,
            reason
        });

        return res.status(201).json({
            success: true,
            message: "Access request submitted",
            data: request
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function requestEmergencyAccess(req, res) {
    try {
        const { patientAddress, doctorAddress, reason } = req.body;
        const request = await blockchainService.requestEmergencyAccess({
            patientAddress,
            doctorAddress,
            reason
        });

        return res.status(201).json({
            success: true,
            message: "Emergency access request submitted",
            data: request
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function getAccessibleRecords(req, res) {
    try {
        const { doctorAddress } = req.params;
        const records = await blockchainService.getDoctorAccessibleRecords(doctorAddress);

        return res.status(200).json({
            success: true,
            data: records
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function getConsentLogs(req, res) {
    try {
        const { doctorAddress } = req.params;
        const logs = await blockchainService.getConsentLogs({ doctorAddress });

        return res.status(200).json({
            success: true,
            data: logs
        });
    } catch (error) {
        return handleError(res, error);
    }
}

module.exports = {
    registerDoctor,
    requestAccess,
    requestEmergencyAccess,
    getAccessibleRecords,
    getConsentLogs
};
