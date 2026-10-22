"use client";

import { NIVELES } from "@/lib/formato";
import { cambiarNivelProducto } from "../actions";

// Cambia el nivel del producto apenas se elige otro en la lista.
export function CambiarNivel({ id, nivel }: { id: string; nivel: string | null }) {
  return (
    <form action={cambiarNivelProducto}>
      <input type="hidden" name="id" value={id} />
      <select className="input nivel-select" name="nivel" defaultValue={nivel ?? ""} aria-label="Nivel" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        <option value="">Todos los niveles</option>
        {NIVELES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </form>
  );
}
