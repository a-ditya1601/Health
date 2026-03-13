const mongoose = require("mongoose");

const emergencyAccessSchema = new mongoose.Schema(
    {
        patientAddress: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true
        },
        doctorAddress: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true
        },
        active: {
            type: Boolean,
            default: true,
            index: true
        },
        grantedAt: {
            type: Date,
            default: Date.now
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true
        },
        reason: {
            type: String,
            default: ""
        },
        txHash: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

emergencyAccessSchema.index({ patientAddress: 1, doctorAddress: 1 }, { unique: true });

module.exports =
    mongoose.models.EmergencyAccess ||
    mongoose.model("EmergencyAccess", emergencyAccessSchema);
