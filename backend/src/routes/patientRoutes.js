const express = require("express");
const patientController = require("../controllers/patientController");

const router = express.Router();

router.post("/register", patientController.registerPatient);
router.post("/access/grant", patientController.grantDoctorAccess);
router.post("/grant-access", patientController.grantDoctorAccess);
router.post("/access/revoke", patientController.revokeDoctorAccess);
router.post("/revoke-access", patientController.revokeDoctorAccess);
router.post("/access/reject", patientController.rejectAccessRequest);
router.post("/reject-access", patientController.rejectAccessRequest);
router.post("/assign-guardian", patientController.assignGuardian);
router.post("/access/emergency/grant", patientController.grantEmergencyAccess);
router.get("/access-analytics", patientController.getAccessAnalytics);
router.get("/:patientAddress/logs", patientController.getConsentLogs);
router.get("/:patientAddress/records", patientController.getPatientRecords);
router.get("/:patientAddress/access-requests", patientController.getAccessRequests);

module.exports = router;
