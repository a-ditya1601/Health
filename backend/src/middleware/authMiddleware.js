function normalizeWalletAddress(address) {
    if (!address || typeof address !== "string") {
        return "";
    }

    return address.trim().toLowerCase();
}

function getWalletAddressFromRequest(req) {
    const headerAddress =
        req.headers["x-wallet-address"] ||
        req.headers["x-user-wallet"] ||
        req.headers["x-auth-wallet"];

    if (headerAddress) {
        return normalizeWalletAddress(headerAddress);
    }

    const authorization = req.headers.authorization || "";
    if (authorization.toLowerCase().startsWith("bearer ")) {
        return normalizeWalletAddress(authorization.slice(7));
    }

    return "";
}

function attachAuthenticatedWallet(req) {
    if (req.auth?.walletAddress) {
        return req.auth.walletAddress;
    }

    const walletAddress = getWalletAddressFromRequest(req);

    if (!walletAddress) {
        return "";
    }

    req.auth = {
        walletAddress
    };

    return walletAddress;
}

function authenticateWallet(req, res, next) {
    const walletAddress = attachAuthenticatedWallet(req);

    if (!walletAddress) {
        return res.status(401).json({
            success: false,
            message: "Authentication required. Provide a wallet address in x-wallet-address or Authorization."
        });
    }

    return next();
}

function requireAuthenticatedWallet(req) {
    const walletAddress = attachAuthenticatedWallet(req);

    if (!walletAddress) {
        const error = new Error("Authentication required");
        error.statusCode = 401;
        throw error;
    }

    return walletAddress;
}

function ensureWalletMatch(expectedAddress, actualAddress, message = "Wallet is not authorized for this action") {
    if (normalizeWalletAddress(expectedAddress) !== normalizeWalletAddress(actualAddress)) {
        const error = new Error(message);
        error.statusCode = 403;
        throw error;
    }
}

module.exports = {
    attachAuthenticatedWallet,
    authenticateWallet,
    ensureWalletMatch,
    normalizeWalletAddress,
    requireAuthenticatedWallet
};
