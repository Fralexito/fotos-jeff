import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Fuente servida desde la propia web (sin esperar a Google en cada carga).
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Fotos Jeff",
  description: "Fotografía escolar en Nauta e Iquitos: promociones, graduaciones y carnets.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
