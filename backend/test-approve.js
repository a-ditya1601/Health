const mongoose = require("mongoose");
const Patient = require("./models/Patient");
const EmergencyAccessRequest = require("./models/EmergencyAccessRequest");
const EmergencyAccess = require("./models/EmergencyAccess");

async function run() {
    await mongoose.connect("mongodb://127.0.0.1:27017/patientHealthData");
    
    const guardianWallet = "0xguardianTestWallet456".toLowerCase();

    // 1. Find the pending request we created earlier
    const pendingRequests = await EmergencyAccessRequest.find({ 
        guardianAddress: guardianWallet,
        status: 'pending' 
    });

    if (pendingRequests.length === 0) {
        console.log("No pending requests found to approve.");
        process.exit(0);
    }

    const requestId = pendingRequests[0]._id;
    console.log("Approving request:", requestId);

    // 2. Mock the behavior of POST /approve
    const fetch = require("node-fetch");
    const response = await fetch("http://localhost:5000/api/emergency/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId })
    });

    const data = await response.json();
    console.log("Approval Response:", data);

    // 3. Verify the EmergencyAccess record exists now
    const accesses = await EmergencyAccess.find({
        patientAddress: pendingRequests[0].patientAddress,
        doctorAddress: pendingRequests[0].doctorAddress
    });
    
    console.log("Doctor's Emergency Access Records in DB:", accesses);

    process.exit(0);
}

run();
