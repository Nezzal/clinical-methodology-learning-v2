import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import SuspensionGuard from "@/components/SuspensionGuard";
import MobileOverlay from "@/components/MobileOverlay";

export const metadata: Metadata = {
  title: "Methodo&Clinique - Formation en Recherche Clinique",
  description: "Plateforme d'apprentissage en ligne de la méthodologie de recherche clinique et générateur de protocole.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <SuspensionGuard>
            {children}
          </SuspensionGuard>
        </AuthProvider>
        <MobileOverlay />
      </body>
    </html>
  );
}