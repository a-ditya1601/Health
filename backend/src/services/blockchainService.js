const crypto = require("crypto");

let ethers;
try {
    ({ ethers } = require("ethers"));
} catch (error) {
    ethers = null;
}

const AccessLog = require("../../models/AccessLog");
const Counter = require("../../models/Counter");
const Doctor = require("../../models/Doctor");
const EmergencyAccess = require("../../models/EmergencyAccess");
const MedicalRecord = require("../../models/MedicalRecord");
const Patient = require("../../models/Patient");

const CONTRACT_ABI = [
    "function patients(address) view returns (bool isRegistered, string metadataURI, uint256 registeredAt)",
    "function doctors(address) view returns (bool isRegistered, string metadataURI, uint256 registeredAt)",
    "function registerPatientByRelayer(address patient, string metadataURI)",
    "function registerDoctorByRelayer(address doctor, string metadataURI)",
    "function requestDoctorAccessByRelayer(address doctor, address patient, string reason)",
    "function storeMedicalRecordByRelayer(address patient, string ipfsHash, string encryptedKeyHash, string recordType)",
    "function grantDoctorAccessByRelayer(address patient, address doctor, uint256 durationInSeconds, string reason)",
    "function revokeDoctorAccessByRelayer(address patient, address doctor)",
    "function requestEmergencyAccessByRelayer(address doctor, address patient, string reason)",
    "function grantEmergencyAccessByRelayer(address patient, address doctor, uint256 durationInSeconds, string reason)",
    "function hasDoctorAccess(address patient, address doctor) view returns (bool)",
    "function getPatientRecordIds(address patient) view returns (uint256[])",
    "function records(uint256) view returns (uint256 recordId, address patient, string ipfsHash, string encryptedKeyHash, string recordType, uint256 createdAt, bool exists)"
];

let cachedContract = null;

function isContractMode() {
    return (
        process.env.BLOCKCHAIN_MODE === "contract" &&
        Boolean(process.env.POLYGON_RPC_URL) &&
        Boolean(process.env.HEALTH_RECORD_CONTRACT_ADDRESS) &&
        Boolean(process.env.RELAYER_PRIVATE_KEY) &&
        Boolean(ethers)
    );
}

function normalizeAddress(address) {
    if (!address || typeof address !== "string") {
        throw new Error("A valid wallet address is required");
    }

    return address.trim().toLowerCase();
}

function createTxHash(seed) {
    return `0x${crypto.createHash("sha256").update(seed).digest("hex")}`;
}

function getContract() {
    if (!isContractMode()) {
        return null;
    }

    if (!cachedContract) {
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const signer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);

        cachedContract = new ethers.Contract(
            process.env.HEALTH_RECORD_CONTRACT_ADDRESS,
            CONTRACT_ABI,
            signer
        );
    }

    return cachedContract;
}

async function sendContractTransaction(method, args) {
    const contract = getContract();

    if (!contract) {
        return null;
    }

    const tx = await contract[method](...args);
    await tx.wait();
    return tx.hash;
}

async function getNextSequence(key) {
    const counter = await Counter.findOneAndUpdate(
        { key },
        { $inc: { value: 1 } },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    return counter.value;
}

async function ensurePatientExists(patientAddress) {
    const normalized = normalizeAddress(patientAddress);
    const existingPatient = await Patient.findOne({ walletAddress: normalized }).lean();

    if (existingPatient) {
        return normalized;
    }

    const contract = getContract();
    if (contract) {
        const patient = await contract.patients(normalized);
        if (patient.isRegistered) {
            await Patient.findOneAndUpdate(
                { walletAddress: normalized },
                {
                    walletAddress: normalized,
                    metadataURI: patient.metadataURI,
                    registeredAt: new Date(Number(patient.registeredAt) * 1000)
                },
                {
                    new: true,
                    upsert: true
                }
            );

            return normalized;
        }
    }

    throw new Error("Patient is not registered");
}

async function ensureDoctorExists(doctorAddress) {
    const normalized = normalizeAddress(doctorAddress);
    const existingDoctor = await Doctor.findOne({ walletAddress: normalized }).lean();

    if (existingDoctor) {
        return normalized;
    }

    const contract = getContract();
    if (contract) {
        const doctor = await contract.doctors(normalized);
        if (doctor.isRegistered) {
            await Doctor.findOneAndUpdate(
                { walletAddress: normalized },
                {
                    walletAddress: normalized,
                    metadataURI: doctor.metadataURI,
                    registeredAt: new Date(Number(doctor.registeredAt) * 1000)
                },
                {
                    new: true,
                    upsert: true
                }
            );

            return normalized;
        }
    }

    throw new Error("Doctor is not registered");
}

function mapPatient(doc) {
    return {
        walletAddress: doc.walletAddress,
        metadataURI: doc.metadataURI,
        registeredAt: new Date(doc.registeredAt).toISOString()
    };
}

function mapDoctor(doc) {
    return {
        walletAddress: doc.walletAddress,
        metadataURI: doc.metadataURI,
        registeredAt: new Date(doc.registeredAt).toISOString()
    };
}

function mapMedicalRecord(doc) {
    if (!doc) {
        return null;
    }

    const timelineEvents = Array.isArray(doc.timelineEvents)
        ? doc.timelineEvents.map((event) => ({
              date: event.date || "Unknown",
              type: event.type,
              finding: event.finding,
              risk: event.risk || "",
              sourceText: event.sourceText || ""
          }))
        : [];

    return {
        recordId: doc.recordId,
        patientAddress: doc.patientAddress,
        ipfsHash: doc.ipfsHash,
        encryptedKeyHash: doc.encryptedKeyHash,
        recordType: doc.recordType,
        fileName: doc.fileName || null,
        contentType: doc.contentType || null,
        aiSummary: doc.aiSummary || null,
        timelineEvents,
        createdAt: new Date(doc.createdAt).toISOString(),
        txHash: doc.txHash || null
    };
}

function mapAccessLog(doc) {
    if (!doc) {
        return null;
    }

    return {
        logId: doc.logId,
        requestId: doc.requestId ?? null,
        recordId: doc.recordId ?? null,
        patientAddress: doc.patientAddress || null,
        doctorAddress: doc.doctorAddress || null,
        action: doc.action,
        status: doc.status || null,
        details: doc.details || {},
        expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : null,
        respondedAt: doc.respondedAt ? new Date(doc.respondedAt).toISOString() : null,
        timestamp: new Date(doc.timestamp).toISOString(),
        txHash: doc.txHash || null
    };
}

function mapAccessRequest(doc) {
    return {
        requestId: doc.requestId,
        patientAddress: doc.patientAddress,
        doctorAddress: doc.doctorAddress,
        reason: doc.details?.reason || "",
        status: doc.status || "pending",
        createdAt: new Date(doc.timestamp).toISOString(),
        respondedAt: doc.respondedAt ? new Date(doc.respondedAt).toISOString() : null,
        txHash: doc.txHash || null
    };
}

function mapStandardAccess(access, patientAddress) {
    return {
        patientAddress,
        doctorAddress: access.doctorAddress,
        active: access.active,
        grantedAt: new Date(access.grantedAt).toISOString(),
        expiresAt: new Date(access.expiresAt).toISOString(),
        reason: access.reason || "",
        txHash: access.txHash || null
    };
}

function mapEmergencyAccess(doc) {
    return {
        patientAddress: doc.patientAddress,
        doctorAddress: doc.doctorAddress,
        active: doc.active,
        grantedAt: new Date(doc.grantedAt).toISOString(),
        expiresAt: new Date(doc.expiresAt).toISOString(),
        reason: doc.reason || "",
        txHash: doc.txHash || null
    };
}

async function createConsentLog({
    patientAddress,
    doctorAddress = null,
    recordId = null,
    requestId = null,
    action,
    status = null,
    details = {},
    expiresAt = null,
    respondedAt = null,
    txHash = null
}) {
    const logId = await getNextSequence("accessLogId");

    const log = await AccessLog.create({
        logId,
        requestId,
        recordId,
        patientAddress: patientAddress ? normalizeAddress(patientAddress) : null,
        doctorAddress: doctorAddress ? normalizeAddress(doctorAddress) : null,
        action,
        status,
        details,
        expiresAt,
        respondedAt,
        timestamp: new Date(),
        txHash: txHash || createTxHash(`${Date.now()}-${action}-${JSON.stringify(details)}`)
    });

    return mapAccessLog(log);
}

async function updatePatientStandardAccess({
    patientAddress,
    doctorAddress,
    active,
    grantedAt,
    expiresAt,
    reason,
    txHash
}) {
    const patient = await Patient.findOne({ walletAddress: patientAddress });
    if (!patient) {
        throw new Error("Patient is not registered");
    }

    const filteredAccesses = patient.standardAccesses.filter(
        (access) => access.doctorAddress !== doctorAddress
    );

    filteredAccesses.push({
        doctorAddress,
        active,
        grantedAt,
        expiresAt,
        reason,
        txHash
    });

    patient.standardAccesses = filteredAccesses;
    await patient.save();

    return patient.standardAccesses.find((access) => access.doctorAddress === doctorAddress);
}

async function registerPatient({ patientAddress, metadataURI = "" }) {
    const normalizedPatient = normalizeAddress(patientAddress);
    const txHash = await sendContractTransaction("registerPatientByRelayer", [
        normalizedPatient,
        metadataURI
    ]);

    const patient = await Patient.findOneAndUpdate(
        { walletAddress: normalizedPatient },
        {
            walletAddress: normalizedPatient,
            metadataURI,
            registeredAt: new Date()
        },
        {
            new: true,
            upsert: true
        }
    );

    await createConsentLog({
        patientAddress: normalizedPatient,
        action: "PATIENT_REGISTERED",
        details: { metadataURI },
        txHash
    });

    return {
        ...mapPatient(patient),
        txHash
    };
}

async function registerDoctor({ doctorAddress, metadataURI = "" }) {
    const normalizedDoctor = normalizeAddress(doctorAddress);
    const txHash = await sendContractTransaction("registerDoctorByRelayer", [
        normalizedDoctor,
        metadataURI
    ]);

    const doctor = await Doctor.findOneAndUpdate(
        { walletAddress: normalizedDoctor },
        {
            walletAddress: normalizedDoctor,
            metadataURI,
            registeredAt: new Date()
        },
        {
            new: true,
            upsert: true
        }
    );

    await createConsentLog({
        doctorAddress: normalizedDoctor,
        action: "DOCTOR_REGISTERED",
        details: { metadataURI },
        txHash
    });

    return {
        ...mapDoctor(doctor),
        txHash
    };
}

async function saveMedicalRecord({
    patientAddress,
    ipfsHash,
    encryptedKeyHash,
    recordType = "medical-report",
    fileName,
    contentType,
    aiSummary,
    timelineEvents = []
}) {
    const normalizedPatient = await ensurePatientExists(patientAddress);
    const recordId = await getNextSequence("medicalRecordId");
    const txHash = await sendContractTransaction("storeMedicalRecordByRelayer", [
        normalizedPatient,
        ipfsHash,
        encryptedKeyHash,
        recordType
    ]);

    const record = await MedicalRecord.create({
        recordId,
        patientAddress: normalizedPatient,
        ipfsHash,
        encryptedKeyHash,
        recordType,
        fileName,
        contentType,
        aiSummary: aiSummary || null,
        timelineEvents,
        createdAt: new Date(),
        txHash
    });

    await createConsentLog({
        patientAddress: normalizedPatient,
        recordId,
        action: "RECORD_UPLOADED",
        details: { ipfsHash, recordType, fileName },
        txHash
    });

    return mapMedicalRecord(record);
}

async function createAccessRequest({ patientAddress, doctorAddress, reason = "" }) {
    const normalizedPatient = await ensurePatientExists(patientAddress);
    const normalizedDoctor = await ensureDoctorExists(doctorAddress);
    const txHash = await sendContractTransaction("requestDoctorAccessByRelayer", [
        normalizedDoctor,
        normalizedPatient,
        reason
    ]);
    const requestId = await getNextSequence("accessRequestId");

    const log = await createConsentLog({
        patientAddress: normalizedPatient,
        doctorAddress: normalizedDoctor,
        requestId,
        action: "ACCESS_REQUESTED",
        status: "pending",
        details: { reason },
        txHash
    });

    return {
        requestId,
        patientAddress: normalizedPatient,
        doctorAddress: normalizedDoctor,
        reason,
        status: log.status,
        createdAt: log.timestamp,
        txHash
    };
}

async function grantDoctorAccess({
    patientAddress,
    doctorAddress,
    durationInSeconds,
    reason = ""
}) {
    const normalizedPatient = await ensurePatientExists(patientAddress);
    const normalizedDoctor = await ensureDoctorExists(doctorAddress);

    if (!durationInSeconds || Number(durationInSeconds) <= 0) {
        throw new Error("A positive access duration is required");
    }

    const txHash = await sendContractTransaction("grantDoctorAccessByRelayer", [
        normalizedPatient,
        normalizedDoctor,
        Number(durationInSeconds),
        reason
    ]);

    const grantedAt = new Date();
    const expiresAt = new Date(grantedAt.getTime() + Number(durationInSeconds) * 1000);

    const access = await updatePatientStandardAccess({
        patientAddress: normalizedPatient,
        doctorAddress: normalizedDoctor,
        active: true,
        grantedAt,
        expiresAt,
        reason,
        txHash
    });

    const pendingRequest = await AccessLog.findOne({
        patientAddress: normalizedPatient,
        doctorAddress: normalizedDoctor,
        action: "ACCESS_REQUESTED",
        status: "pending"
    }).sort({ timestamp: -1 });

    if (pendingRequest) {
        pendingRequest.status = "approved";
        pendingRequest.respondedAt = new Date();
        await pendingRequest.save();
    }

    await createConsentLog({
        patientAddress: normalizedPatient,
        doctorAddress: normalizedDoctor,
        action: "ACCESS_GRANTED",
        details: { durationInSeconds: Number(durationInSeconds), expiresAt, reason },
        expiresAt,
        txHash
    });

    return mapStandardAccess(access, normalizedPatient);
}

async function revokeDoctorAccess({ patientAddress, doctorAddress }) {
    const normalizedPatient = await ensurePatientExists(patientAddress);
    const normalizedDoctor = await ensureDoctorExists(doctorAddress);
    const txHash = await sendContractTransaction("revokeDoctorAccessByRelayer", [
        normalizedPatient,
        normalizedDoctor
    ]);

    const revokedAt = new Date();

    await updatePatientStandardAccess({
        patientAddress: normalizedPatient,
        doctorAddress: normalizedDoctor,
        active: false,
        grantedAt: revokedAt,
        expiresAt: revokedAt,
        reason: "Access revoked by patient",
        txHash
    });

    await EmergencyAccess.findOneAndUpdate(
        {
            patientAddress: normalizedPatient,
            doctorAddress: normalizedDoctor
        },
        {
            active: false,
            expiresAt: revokedAt
        }
    );

    await createConsentLog({
        patientAddress: normalizedPatient,
        doctorAddress: normalizedDoctor,
        action: "ACCESS_REVOKED",
        details: {},
        txHash
    });

    return {
        patientAddress: normalizedPatient,
        doctorAddress: normalizedDoctor,
        revokedAt: revokedAt.toISOString(),
        txHash
    };
}

async function requestEmergencyAccess({ patientAddress, doctorAddress, reason }) {
    const normalizedPatient = await ensurePatientExists(patientAddress);
    const normalizedDoctor = await ensureDoctorExists(doctorAddress);
    const txHash = await sendContractTransaction("requestEmergencyAccessByRelayer", [
        normalizedDoctor,
        normalizedPatient,
        reason
    ]);

    await createConsentLog({
        patientAddress: normalizedPatient,
        doctorAddress: normalizedDoctor,
        action: "EMERGENCY_ACCESS_REQUESTED",
        status: "pending",
        details: { reason },
        txHash
    });

    return {
        patientAddress: normalizedPatient,
        doctorAddress: normalizedDoctor,
        requestedAt: new Date().toISOString(),
        reason,
        txHash
    };
}

async function grantEmergencyAccess({
    patientAddress,
    doctorAddress,
    durationInSeconds,
    reason
}) {
    const normalizedPatient = await ensurePatientExists(patientAddress);
    const normalizedDoctor = await ensureDoctorExists(doctorAddress);

    if (!durationInSeconds || Number(durationInSeconds) <= 0) {
        throw new Error("A positive emergency access duration is required");
    }

    const txHash = await sendContractTransaction("grantEmergencyAccessByRelayer", [
        normalizedPatient,
        normalizedDoctor,
        Number(durationInSeconds),
        reason
    ]);

    const grantedAt = new Date();
    const expiresAt = new Date(grantedAt.getTime() + Number(durationInSeconds) * 1000);

    const emergencyAccess = await EmergencyAccess.findOneAndUpdate(
        {
            patientAddress: normalizedPatient,
            doctorAddress: normalizedDoctor
        },
        {
            patientAddress: normalizedPatient,
            doctorAddress: normalizedDoctor,
            active: true,
            grantedAt,
            expiresAt,
            reason,
            txHash
        },
        {
            new: true,
            upsert: true
        }
    );

    const pendingRequest = await AccessLog.findOne({
        patientAddress: normalizedPatient,
        doctorAddress: normalizedDoctor,
        action: "EMERGENCY_ACCESS_REQUESTED",
        status: "pending"
    }).sort({ timestamp: -1 });

    if (pendingRequest) {
        pendingRequest.status = "approved";
        pendingRequest.respondedAt = new Date();
        await pendingRequest.save();
    }

    await createConsentLog({
        patientAddress: normalizedPatient,
        doctorAddress: normalizedDoctor,
        action: "EMERGENCY_ACCESS_GRANTED",
        details: { durationInSeconds: Number(durationInSeconds), expiresAt, reason },
        expiresAt,
        txHash
    });

    return mapEmergencyAccess(emergencyAccess);
}

async function hasActiveAccess(patientAddress, doctorAddress) {
    const normalizedPatient = normalizeAddress(patientAddress);
    const normalizedDoctor = normalizeAddress(doctorAddress);
    const now = new Date();

    const patient = await Patient.findOne({ walletAddress: normalizedPatient }).lean();
    const standardAccess = patient?.standardAccesses?.find(
        (access) =>
            access.doctorAddress === normalizedDoctor &&
            access.active &&
            new Date(access.expiresAt).getTime() > now.getTime()
    );

    if (standardAccess) {
        return true;
    }

    const emergencyAccess = await EmergencyAccess.findOne({
        patientAddress: normalizedPatient,
        doctorAddress: normalizedDoctor,
        active: true,
        expiresAt: { $gt: now }
    }).lean();

    if (emergencyAccess) {
        return true;
    }

    const contract = getContract();
    if (contract) {
        try {
            return await contract.hasDoctorAccess(normalizedPatient, normalizedDoctor);
        } catch (error) {
            if (process.env.NODE_ENV === "production") {
                throw error;
            }
        }
    }

    return false;
}

async function getPatientRecords(patientAddress) {
    const normalizedPatient = await ensurePatientExists(patientAddress);
    const records = await MedicalRecord.find({ patientAddress: normalizedPatient })
        .sort({ createdAt: -1 })
        .lean();

    if (records.length) {
        return records.map(mapMedicalRecord);
    }

    const contract = getContract();
    if (!contract) {
        return [];
    }

    const recordIds = await contract.getPatientRecordIds(normalizedPatient);
    const syncedRecords = [];

    for (const rawId of recordIds) {
        const recordId = Number(rawId);
        const existingRecord = await MedicalRecord.findOne({ recordId }).lean();
        if (existingRecord) {
            syncedRecords.push(existingRecord);
            continue;
        }

        const chainRecord = await contract.records(recordId);
        if (!chainRecord.exists) {
            continue;
        }

        const createdRecord = await MedicalRecord.create({
            recordId,
            patientAddress: chainRecord.patient,
            ipfsHash: chainRecord.ipfsHash,
            encryptedKeyHash: chainRecord.encryptedKeyHash,
            recordType: chainRecord.recordType,
            createdAt: new Date(Number(chainRecord.createdAt) * 1000),
            aiSummary: null,
            timelineEvents: [],
            txHash: null
        });

        syncedRecords.push(createdRecord.toObject());
    }

    return syncedRecords.map(mapMedicalRecord);
}

async function getDoctorAccessibleRecords(doctorAddress) {
    const normalizedDoctor = await ensureDoctorExists(doctorAddress);
    const now = new Date();

    const patientsWithStandardAccess = await Patient.find({
        standardAccesses: {
            $elemMatch: {
                doctorAddress: normalizedDoctor,
                active: true,
                expiresAt: { $gt: now }
            }
        }
    }).lean();

    const emergencyAccesses = await EmergencyAccess.find({
        doctorAddress: normalizedDoctor,
        active: true,
        expiresAt: { $gt: now }
    }).lean();

    const accessLookup = new Map();

    for (const patient of patientsWithStandardAccess) {
        const access = patient.standardAccesses.find(
            (entry) =>
                entry.doctorAddress === normalizedDoctor &&
                entry.active &&
                new Date(entry.expiresAt).getTime() > now.getTime()
        );

        if (access) {
            accessLookup.set(patient.walletAddress, {
                accessMode: "standard",
                expiresAt: new Date(access.expiresAt).toISOString()
            });
        }
    }

    for (const access of emergencyAccesses) {
        accessLookup.set(access.patientAddress, {
            accessMode: "emergency",
            expiresAt: new Date(access.expiresAt).toISOString()
        });
    }

    if (!accessLookup.size) {
        return [];
    }

    const patientAddresses = Array.from(accessLookup.keys());
    const records = await MedicalRecord.find({
        patientAddress: { $in: patientAddresses }
    })
        .sort({ createdAt: -1 })
        .lean();

    return records.map((record) => ({
        ...mapMedicalRecord(record),
        accessMode: accessLookup.get(record.patientAddress)?.accessMode || "standard",
        expiresAt: accessLookup.get(record.patientAddress)?.expiresAt || null
    }));
}

async function getRecordById(recordId) {
    const numericId = Number(recordId);
    const existingRecord = await MedicalRecord.findOne({ recordId: numericId }).lean();

    if (existingRecord) {
        return mapMedicalRecord(existingRecord);
    }

    const contract = getContract();
    if (!contract) {
        throw new Error("Record not found");
    }

    const chainRecord = await contract.records(numericId);
    if (!chainRecord.exists) {
        throw new Error("Record not found");
    }

    const syncedRecord = await MedicalRecord.create({
        recordId: numericId,
        patientAddress: chainRecord.patient,
        ipfsHash: chainRecord.ipfsHash,
        encryptedKeyHash: chainRecord.encryptedKeyHash,
        recordType: chainRecord.recordType,
        createdAt: new Date(Number(chainRecord.createdAt) * 1000),
        aiSummary: null,
        timelineEvents: [],
        txHash: null
    });

    return mapMedicalRecord(syncedRecord);
}

async function getConsentLogs({ patientAddress, doctorAddress, recordId }) {
    const query = {};

    if (patientAddress) {
        query.patientAddress = normalizeAddress(patientAddress);
    }

    if (doctorAddress) {
        query.doctorAddress = normalizeAddress(doctorAddress);
    }

    if (recordId) {
        query.recordId = Number(recordId);
    }

    const logs = await AccessLog.find(query).sort({ timestamp: -1 }).lean();
    return logs.map(mapAccessLog);
}

async function getAccessRequests(patientAddress) {
    const normalizedPatient = await ensurePatientExists(patientAddress);
    const requests = await AccessLog.find({
        patientAddress: normalizedPatient,
        action: "ACCESS_REQUESTED"
    })
        .sort({ timestamp: -1 })
        .lean();

    return requests.map(mapAccessRequest);
}

module.exports = {
    registerPatient,
    registerDoctor,
    saveMedicalRecord,
    createAccessRequest,
    grantDoctorAccess,
    revokeDoctorAccess,
    requestEmergencyAccess,
    grantEmergencyAccess,
    hasActiveAccess,
    getPatientRecords,
    getDoctorAccessibleRecords,
    getRecordById,
    getConsentLogs,
    getAccessRequests
};
