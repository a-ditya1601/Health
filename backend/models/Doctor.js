const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
    {
        walletAddress: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        metadataURI: {
            type: String,
            default: ""
        },
        registeredAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.models.Doctor || mongoose.model("Doctor", doctorSchema);
