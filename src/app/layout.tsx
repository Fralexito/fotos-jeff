import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fotos Jeff",
  description: "Fotografía escolar en Nauta e Iquitos: promociones, graduaciones y carnets.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
