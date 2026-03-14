const express = require("express");
const recordController = require("../controllers/recordController");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router.post("/upload", upload.single("file"), recordController.uploadMedicalRecord);
router.get("/patient/:patientAddress", recordController.getPatientRecords);
router.get("/doctor/:doctorAddress", recordController.getDoctorRecords);
router.get("/:recordId", recordController.getRecordById);
router.delete("/:recordId", recordController.deleteMedicalRecord);

module.exports = router;
