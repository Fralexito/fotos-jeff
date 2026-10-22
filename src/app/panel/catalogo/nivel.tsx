"use client";

import { CATEGORIAS, NIVELES } from "@/lib/formato";
import { cambiarCategoriaProducto } from "../actions";

// Cambia la categoría (y el nivel, en promociones) apenas se elige otra opción.
export function CambiarCategoria({ id, categoria, nivel }: { id: string; categoria: string; nivel: string | null }) {
  const enviar = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();
  return (
    <form action={cambiarCategoriaProducto} className="cat-form">
      <input type="hidden" name="id" value={id} />
      <select className="input nivel-select" name="categoria" defaultValue={categoria} aria-label="Categoría" onChange={enviar}>
        {CATEGORIAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      {categoria === "promocion" && (
        <select className="input nivel-select" name="nivel" defaultValue={nivel ?? ""} aria-label="Nivel" onChange={enviar}>
          <option value="">Todos los niveles</option>
          {NIVELES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      )}
    </form>
  );
}
