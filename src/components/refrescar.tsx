"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Vuelve a pedir los datos cada cierto tiempo, para pantallas que se dejan abiertas.
export function Refrescar({ activo = true, cada = 8000 }: { activo?: boolean; cada?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => router.refresh(), cada);
    return () => clearInterval(t);
  }, [activo, cada, router]);
  return null;
}
