require("dotenv").config();

const cors = require("cors");
const express = require("express");

const { summarizeMedicalReport } = require("./summarizer");

const app = express();
const PORT = Number(process.env.PORT || 8000);

app.use(
    cors({
        origin: process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(",").map((value) => value.trim())
            : true,
        credentials: true
    })
);
app.use(express.json({ limit: "20mb" }));

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "AI summarization service is running"
    });
});

app.post("/api/summarize", async (req, res) => {
    try {
        const { text, pdfBase64, reportId, fileName, reportType } = req.body;
        const pdfBuffer = pdfBase64 ? Buffer.from(pdfBase64, "base64") : null;

        const result = await summarizeMedicalReport({
            text,
            pdfBuffer,
            reportId,
            fileName,
            reportType
        });

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("AI service error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Unable to summarize medical report"
        });
    }
});

app.listen(PORT, () => {
    console.log(`AI service listening on http://localhost:${PORT}`);
});
