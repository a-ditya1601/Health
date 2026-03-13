const mongoose = require("mongoose");

const DEFAULT_URI = "mongodb://127.0.0.1:27017/patient-owned-health-data";

async function connectDatabase() {
    const mongoUri = process.env.MONGODB_URI || DEFAULT_URI;

    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    await mongoose.connect(mongoUri, {
        autoIndex: true
    });

    console.log(`MongoDB connected: ${mongoUri}`);
    return mongoose.connection;
}

module.exports = {
    connectDatabase
};
