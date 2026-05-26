import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import SuspensionGuard from "@/components/SuspensionGuard";

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
    <html lang="fr" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <SuspensionGuard>
            {children}
          </SuspensionGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
