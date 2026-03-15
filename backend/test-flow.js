const mongoose = require("mongoose");
const Patient = require("./models/Patient");
const EmergencyAccessRequest = require("./models/EmergencyAccessRequest");
const AccessLog = require("./models/AccessLog");

async function run() {
    await mongoose.connect("mongodb://127.0.0.1:27017/patientHealthData");
    
    const patientWallet = "0xd485db50c7bc24059".toLowerCase();
    const doctorWallet = "0xDoctorTestWallet123".toLowerCase();
    const guardianWallet = "0xGuardianTestWallet456".toLowerCase();

    // 1. Assign Guardian
    await Patient.findOneAndUpdate(
        { walletAddress: patientWallet },
        { 
            walletAddress: patientWallet,
            guardianWalletAddress: guardianWallet 
        },
        { new: true, upsert: true }
    );
    console.log("Guardian assigned.");

    // 2. Mock exactly what emergencyRoutes.js does
    const emergencyRequest = new EmergencyAccessRequest({
        patientAddress: patientWallet,
        doctorAddress: doctorWallet,
        guardianAddress: guardianWallet,
        reason: "Simulated emergency",
        status: 'pending'
    });
    await emergencyRequest.save();
    console.log("Emergency Request created:", emergencyRequest);

    await AccessLog.create({
        patientAddress: patientWallet,
        doctorAddress: doctorWallet,
        action: 'EMERGENCY_ACCESS_REQUESTED',
        details: `Doctor initiated emergency access request.`
    });
    console.log("Emergency AccessLog created.");

    // 3. See what the Guardian fetch query returns
    const guardianRequests = await EmergencyAccessRequest.find({ 
        guardianAddress: guardianWallet,
        status: 'pending' 
    });
    console.log("\nWhat Guardian sees:", guardianRequests);

    // 4. See what the Patient fetch query returns (getAccessRequests)
    const patientRequests = await AccessLog.find({
        patientAddress: patientWallet,
        action: "ACCESS_REQUESTED"
    });
    console.log("\nWhat Patient sees in Doctor Access Requests:", patientRequests);

    process.exit(0);
}

run();
