const mongoose = require("mongoose");

const timelineEventSchema = new mongoose.Schema(
    {
        date: {
            type: String,
            default: "Unknown"
        },
        type: {
            type: String,
            required: true
        },
        finding: {
            type: String,
            required: true
        },
        risk: {
            type: String,
            default: ""
        },
        sourceText: {
            type: String,
            default: ""
        }
    },
    {
        _id: false
    }
);

const medicalRecordSchema = new mongoose.Schema(
    {
        recordId: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        patientAddress: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true
        },
        ipfsHash: {
            type: String,
            required: true
        },
        encryptedKeyHash: {
            type: String,
            required: true
        },
        recordType: {
            type: String,
            default: "medical-report"
        },
        fileName: {
            type: String,
            default: null
        },
        contentType: {
            type: String,
            default: null
        },
        aiSummary: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        timelineEvents: {
            type: [timelineEventSchema],
            default: []
        },
        createdAt: {
            type: Date,
            default: Date.now
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

module.exports = mongoose.models.MedicalRecord || mongoose.model("MedicalRecord", medicalRecordSchema);
