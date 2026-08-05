import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import SuspensionGuard from "@/components/SuspensionGuard";
import MobileOverlay from "@/components/MobileOverlay";

export const metadata: Metadata = {
  title: "Methodo&Clinique - Formation en Recherche Clinique",
  description: "Plateforme d'apprentissage en ligne de la méthodologie de recherche clinique et générateur de protocole.",
};

import SessionTracker from "@/components/SessionTracker";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0b132b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400..800;1,400..800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <SessionTracker />
          <PWAInstallPrompt />
          <SuspensionGuard>
            {children}
          </SuspensionGuard>
        </AuthProvider>
        <MobileOverlay />
      </body>
    </html>
  );
}