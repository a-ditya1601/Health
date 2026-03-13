const mongoose = require("mongoose");

const accessLogSchema = new mongoose.Schema(
    {
        logId: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        requestId: {
            type: Number,
            default: null,
            index: true
        },
        recordId: {
            type: Number,
            default: null,
            index: true
        },
        patientAddress: {
            type: String,
            default: null,
            lowercase: true,
            trim: true,
            index: true
        },
        doctorAddress: {
            type: String,
            default: null,
            lowercase: true,
            trim: true,
            index: true
        },
        action: {
            type: String,
            required: true,
            index: true
        },
        status: {
            type: String,
            default: null
        },
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        expiresAt: {
            type: Date,
            default: null
        },
        respondedAt: {
            type: Date,
            default: null
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true
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

accessLogSchema.index({ patientAddress: 1, doctorAddress: 1, action: 1, timestamp: -1 });
accessLogSchema.index({ recordId: 1, action: 1, timestamp: -1 });

module.exports = mongoose.models.AccessLog || mongoose.model("AccessLog", accessLogSchema);
