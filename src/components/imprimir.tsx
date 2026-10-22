"use client";

import { Printer } from "lucide-react";

export function Imprimir({ label = "Imprimir" }: { label?: string }) {
  return (
    <button type="button" className="btn secondary" onClick={() => window.print()}>
      <Printer className="i" /> {label}
    </button>
  );
}
