const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const DEFAULT_GATEWAY = process.env.IPFS_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs";
const MOCK_STORAGE_DIR = path.resolve(__dirname, "../../.mock-ipfs");

function createMockCid(buffer) {
    return `mock-${crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 46)}`;
}

async function saveMockFile(buffer, cid, metadata) {
    await fs.mkdir(MOCK_STORAGE_DIR, { recursive: true });
    await fs.writeFile(path.join(MOCK_STORAGE_DIR, `${cid}.bin`), buffer);
    await fs.writeFile(
        path.join(MOCK_STORAGE_DIR, `${cid}.json`),
        JSON.stringify(metadata, null, 2),
        "utf8"
    );
}

function buildAuthHeaders() {
    if (process.env.PINATA_JWT) {
        return {
            Authorization: `Bearer ${process.env.PINATA_JWT}`
        };
    }

    if (process.env.IPFS_PROJECT_ID && process.env.IPFS_PROJECT_SECRET) {
        const token = Buffer.from(
            `${process.env.IPFS_PROJECT_ID}:${process.env.IPFS_PROJECT_SECRET}`
        ).toString("base64");

        return {
            Authorization: `Basic ${token}`
        };
    }

    return {};
}

async function uploadToRemoteIpfs(buffer, options = {}) {
    const endpoint =
        process.env.IPFS_API_URL || "https://api.pinata.cloud/pinning/pinFileToIPFS";

    const formData = new FormData();
    const fileName = options.fileName || "record.enc";
    const metadata = {
        name: fileName,
        keyvalues: {
            patientAddress: options.patientAddress || "",
            recordType: options.recordType || "",
            originalName: options.originalFileName || fileName
        }
    };

    formData.append(
        "file",
        new Blob([buffer], { type: options.contentType || "application/octet-stream" }),
        fileName
    );
    formData.append("pinataMetadata", JSON.stringify(metadata));

    const response = await fetch(endpoint, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`IPFS upload failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const cid = payload.IpfsHash || payload.cid || payload.Hash;

    return {
        cid,
        provider: "remote-ipfs",
        gatewayUrl: `${DEFAULT_GATEWAY}/${cid}`
    };
}

async function uploadFile(buffer, options = {}) {
    if (!Buffer.isBuffer(buffer)) {
        throw new Error("IPFS upload expects a Buffer payload");
    }

    try {
        if (process.env.PINATA_JWT || process.env.IPFS_PROJECT_ID || process.env.IPFS_API_URL) {
            return await uploadToRemoteIpfs(buffer, options);
        }
    } catch (error) {
        if (process.env.NODE_ENV === "production") {
            throw error;
        }
    }

    const cid = createMockCid(buffer);
    await saveMockFile(buffer, cid, {
        fileName: options.fileName || "record.enc",
        patientAddress: options.patientAddress || null,
        recordType: options.recordType || null,
        uploadedAt: new Date().toISOString()
    });

    return {
        cid,
        provider: "mock-ipfs",
        gatewayUrl: `${DEFAULT_GATEWAY}/${cid}`
    };
}

module.exports = {
    uploadFile
};
