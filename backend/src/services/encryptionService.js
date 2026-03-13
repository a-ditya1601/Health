const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function toBuffer(value) {
    if (Buffer.isBuffer(value)) {
        return value;
    }

    if (typeof value === "string") {
        return Buffer.from(value);
    }

    throw new Error("Unsupported payload type for encryption");
}

function sha256(input) {
    return crypto.createHash("sha256").update(input).digest("hex");
}

function encryptFile(payload, options = {}) {
    const buffer = toBuffer(payload);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = crypto.randomBytes(KEY_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encryptedBuffer = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const envelopeHash = sha256(Buffer.concat([key, iv, authTag]));

    return {
        encryptedBuffer,
        accessKeyEnvelope: {
            algorithm: ALGORITHM,
            key: key.toString("base64"),
            iv: iv.toString("base64"),
            authTag: authTag.toString("base64"),
            owner: options.owner || null,
            issuedAt: new Date().toISOString()
        },
        encryptionMetadata: {
            algorithm: ALGORITHM,
            keyHash: envelopeHash,
            contentLength: buffer.length,
            encryptedLength: encryptedBuffer.length
        }
    };
}

function decryptFile(payload, accessKeyEnvelope) {
    const encryptedBuffer = toBuffer(payload);

    if (!accessKeyEnvelope?.key || !accessKeyEnvelope?.iv || !accessKeyEnvelope?.authTag) {
        throw new Error("Invalid access key envelope");
    }

    const decipher = crypto.createDecipheriv(
        accessKeyEnvelope.algorithm || ALGORITHM,
        Buffer.from(accessKeyEnvelope.key, "base64"),
        Buffer.from(accessKeyEnvelope.iv, "base64")
    );

    decipher.setAuthTag(Buffer.from(accessKeyEnvelope.authTag, "base64"));

    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

module.exports = {
    encryptFile,
    decryptFile
};
