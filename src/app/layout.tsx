import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import SuspensionGuard from "@/components/SuspensionGuard";
import MobileOverlay from "@/components/MobileOverlay";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RECIF Méthodologie - Formation en Recherche Clinique",
  description: "Plateforme d'apprentissage en ligne de la méthodologie de recherche clinique et générateur de protocole basé sur le manuel de référence RECIF.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className={inter.variable}>
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