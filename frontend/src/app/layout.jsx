import "../styles/globals.css";
import { AuthProvider } from "../context/AuthContext";

export const metadata = {
    title: "Patient-Owned Health Data",
    description: "Patient-controlled health records with blockchain consent, IPFS storage, and AI-assisted summaries."
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    );
}
