const mongoose = require("mongoose");

const standardAccessSchema = new mongoose.Schema(
    {
        doctorAddress: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        active: {
            type: Boolean,
            default: true
        },
        grantedAt: {
            type: Date,
            default: Date.now
        },
        expiresAt: {
            type: Date,
            required: true
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
        _id: false
    }
);

const patientSchema = new mongoose.Schema(
    {
        walletAddress: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        guardianWalletAddress: {
            type: String,
            lowercase: true,
            trim: true,
            default: null
        },
        metadataURI: {
            type: String,
            default: ""
        },
        registeredAt: {
            type: Date,
            default: Date.now
        },
        standardAccesses: {
            type: [standardAccessSchema],
            default: []
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.models.Patient || mongoose.model("Patient", patientSchema);
