const multer = require("multer");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024
    },
    fileFilter: (req, file, callback) => {
        const allowedMimeTypes = ["application/pdf"];

        if (!allowedMimeTypes.includes(file.mimetype)) {
            callback(new Error("Only PDF medical reports are supported"));
            return;
        }

        callback(null, true);
    }
});

module.exports = upload;
