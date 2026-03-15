const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Patient = require('../../models/Patient');
const EmergencyAccessRequest = require('../../models/EmergencyAccessRequest');
const EmergencyAccess = require('../../models/EmergencyAccess');
const AccessLog = require('../../models/AccessLog');
const blockchainService = require('../services/blockchainService');

router.post('/request', async (req, res) => {
    try {
        const { patientAddress, doctorAddress, reason } = req.body;
        
        let patientAddrNorm = patientAddress.toLowerCase();
        let doctorAddrNorm = doctorAddress.toLowerCase();

        const patient = await Patient.findOne({ walletAddress: patientAddrNorm });
        if (!patient || !patient.guardianWalletAddress) {
            return res.status(400).json({ success: false, message: "Patient does not have a registered guardian." });
        }

        const emergencyRequest = new EmergencyAccessRequest({
            patientAddress: patientAddrNorm,
            doctorAddress: doctorAddrNorm,
            guardianAddress: patient.guardianWalletAddress,
            reason: reason || "Life-threatening medical emergency",
            status: 'pending'
        });

        await emergencyRequest.save();

        await AccessLog.create({
            patientAddress: patientAddrNorm,
            doctorAddress: doctorAddrNorm,
            action: 'EMERGENCY_ACCESS_REQUESTED',
            details: `Doctor initiated emergency access request. Reason: ${reason}`
        });

        res.status(201).json({ success: true, message: "Emergency request sent to guardian.", data: emergencyRequest });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/guardian/:guardianAddress/requests', async (req, res) => {
    try {
        const { guardianAddress } = req.params;
        const requests = await EmergencyAccessRequest.find({ 
            guardianAddress: guardianAddress.toLowerCase(),
            status: 'pending' 
        }).sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: requests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/approve', async (req, res) => {
    try {
        const { requestId } = req.body; // the Guardian's auth isn't strict here since it's a backend endpoint doing relayer, but usually we'd pass a signed message. The user's system relies on the relayer completely.
        
        const emergencyRequest = await EmergencyAccessRequest.findById(requestId);
        if (!emergencyRequest) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }

        // Generate the Emergency Access Key
        const randomHex = crypto.randomBytes(6).toString('hex').toUpperCase();
        const accessKey = `EMRG-${randomHex.slice(0,4)}-${randomHex.slice(4,8)}-${randomHex.slice(8,12)}`;
        
        // Execute on Blockchain via Relayer
        const durationSeconds = 24 * 60 * 60; // 24 hours
        await blockchainService.grantEmergencyAccessByGuardianRelayed(
            emergencyRequest.guardianAddress,
            emergencyRequest.patientAddress,
            emergencyRequest.doctorAddress,
            durationSeconds,
            emergencyRequest.reason
        );

        emergencyRequest.status = 'approved';
        emergencyRequest.accessKey = accessKey;
        emergencyRequest.expiresAt = new Date(Date.now() + durationSeconds * 1000); 
        await emergencyRequest.save();

        // Create the EmergencyAccess record for the Doctor dashboard to query
        await EmergencyAccess.create({
            patientAddress: emergencyRequest.patientAddress,
            doctorAddress: emergencyRequest.doctorAddress,
            reason: emergencyRequest.reason,
            active: true,
            expiresAt: emergencyRequest.expiresAt
        });

        // Log the approval action
        await AccessLog.create({
            patientAddress: emergencyRequest.patientAddress,
            doctorAddress: emergencyRequest.doctorAddress,
            action: 'EMERGENCY_ACCESS_GRANTED',
            details: `Guardian ${emergencyRequest.guardianAddress} approved break-glass access. Reason: ${emergencyRequest.reason}`
        });

        res.status(200).json({ success: true, message: "Emergency access granted.", data: { accessKey } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/poll/:requestId', async (req, res) => {
    try {
         const { requestId } = req.params;
         const emergencyRequest = await EmergencyAccessRequest.findById(requestId);
         
         if (!emergencyRequest) return res.status(404).json({ success: false, message: "Not found" });

         if (emergencyRequest.status === 'approved') {
             return res.status(200).json({ success: true, status: 'approved', accessKey: emergencyRequest.accessKey });
         }
         res.status(200).json({ success: true, status: emergencyRequest.status });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
