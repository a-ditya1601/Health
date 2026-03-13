export const METAMASK_DOWNLOAD_URL = "https://metamask.io/download/";

export function getEthereumProvider() {
    if (typeof window === "undefined") {
        return null;
    }

    return window.ethereum || null;
}

export function isMetaMaskInstalled() {
    const provider = getEthereumProvider();
    return Boolean(provider && provider.isMetaMask);
}

export async function connectWallet() {
    const provider = getEthereumProvider();

    if (!provider) {
        const error = new Error("MetaMask is not installed");
        error.code = "METAMASK_MISSING";
        throw error;
    }

    const accounts = await provider.request({
        method: "eth_requestAccounts"
    });

    return accounts?.[0] || null;
}

export async function getConnectedWallet() {
    const provider = getEthereumProvider();

    if (!provider) {
        return null;
    }

    const accounts = await provider.request({
        method: "eth_accounts"
    });

    return accounts?.[0] || null;
}

export function subscribeToWalletChanges({ onAccountsChanged, onChainChanged }) {
    const provider = getEthereumProvider();

    if (!provider?.on) {
        return () => {};
    }

    if (onAccountsChanged) {
        provider.on("accountsChanged", onAccountsChanged);
    }

    if (onChainChanged) {
        provider.on("chainChanged", onChainChanged);
    }

    return () => {
        if (onAccountsChanged && provider.removeListener) {
            provider.removeListener("accountsChanged", onAccountsChanged);
        }

        if (onChainChanged && provider.removeListener) {
            provider.removeListener("chainChanged", onChainChanged);
        }
    };
}

export function shortenAddress(address) {
    if (!address) {
        return "";
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
