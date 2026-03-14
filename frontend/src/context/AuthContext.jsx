"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
    METAMASK_DOWNLOAD_URL,
    connectWallet as connectWalletRequest,
    getConnectedWallet,
    isMetaMaskInstalled,
    subscribeToWalletChanges
} from "../services/blockchain";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [address, setAddress] = useState("");
    const [isConnecting, setIsConnecting] = useState(false);
    const [authError, setAuthError] = useState("");
    const [hasMetaMask, setHasMetaMask] = useState(false);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let active = true;

        async function restoreWallet() {
            const installed = isMetaMaskInstalled();
            if (active) {
                setHasMetaMask(installed);
            }

            if (!installed) {
                if (active) {
                    setIsReady(true);
                }
                return;
            }

            try {
                const connectedAddress = await getConnectedWallet();
                if (active && connectedAddress) {
                    setAddress(connectedAddress);
                }
            } catch (error) {
                if (active) {
                    setAuthError(error.message || "Unable to restore wallet session");
                }
            } finally {
                if (active) {
                    setIsReady(true);
                }
            }
        }

        restoreWallet();

        const unsubscribe = subscribeToWalletChanges({
            onAccountsChanged: (accounts) => {
                if (!active) {
                    return;
                }

                setAddress(accounts?.[0] || "");
                setAuthError("");
            },
            onChainChanged: () => {
                if (!active) {
                    return;
                }

                setAuthError("");
            }
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    async function connectWallet() {
        setIsConnecting(true);
        setAuthError("");

        try {
            const connectedAddress = await connectWalletRequest();
            setHasMetaMask(true);
            setAddress(connectedAddress || "");
            return connectedAddress;
        } catch (error) {
            if (error.code === "METAMASK_MISSING") {
                setHasMetaMask(false);
            }

            setAuthError(error.message || "Unable to connect MetaMask");
            throw error;
        } finally {
            setIsConnecting(false);
        }
    }

    function disconnectWallet() {
        setAddress("");
        setAuthError("");
    }

    const value = useMemo(
        () => ({
            address,
            authError,
            connectWallet,
            disconnectWallet,
            hasMetaMask,
            installUrl: METAMASK_DOWNLOAD_URL,
            isAuthenticated: Boolean(address),
            isConnecting,
            isReady
        }),
        [address, authError, hasMetaMask, isConnecting, isReady]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }

    return context;
}
