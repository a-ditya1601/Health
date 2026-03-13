const express = require("express");
const doctorController = require("../controllers/doctorController");

const router = express.Router();

router.post("/register", doctorController.registerDoctor);
router.post("/access/request", doctorController.requestAccess);
router.post("/access/emergency/request", doctorController.requestEmergencyAccess);
router.get("/:doctorAddress/records", doctorController.getAccessibleRecords);
router.get("/:doctorAddress/logs", doctorController.getConsentLogs);

module.exports = router;
