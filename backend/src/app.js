require("dotenv").config();

const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const patientRoutes = require("./routes/patientRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const recordRoutes = require("./routes/recordRoutes");
const emergencyRoutes = require("./routes/emergencyRoutes");

const app = express();

app.use(
    cors({
        origin: process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(",").map((value) => value.trim())
            : ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
        credentials: true
    })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Patient-Owned Health Data backend is running"
    });
});

app.use("/api/patients", patientRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/emergency", emergencyRoutes);

app.use((err, req, res, next) => {
    console.error("Unhandled backend error:", err);
    res.status(500).json({
        success: false,
        message: err.message || "Internal server error"
    });
});

module.exports = app;
