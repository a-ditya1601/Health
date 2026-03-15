const mongoose = require("mongoose");

const emergencyAccessRequestSchema = new mongoose.Schema({
    patientAddress: { type: String, required: true, lowercase: true, index: true },
    doctorAddress: { type: String, required: true, lowercase: true, index: true },
    guardianAddress: { type: String, required: true, lowercase: true, index: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending', index: true },
    reason: { type: String, required: true },
    accessKey: { type: String },
    txHash: { type: String },
    expiresAt: { type: Date }
}, { timestamps: true });

emergencyAccessRequestSchema.index({ guardianAddress: 1, status: 1 });

module.exports = mongoose.models.EmergencyAccessRequest || mongoose.model("EmergencyAccessRequest", emergencyAccessRequestSchema);
