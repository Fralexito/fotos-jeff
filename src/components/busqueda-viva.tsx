"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";

// Buscador que muestra resultados mientras se escribe: actualiza ?q= en la misma página sin recargarla.
export function BusquedaViva({
  placeholder, autoFocus, className = "bigsearch", boton,
}: { placeholder: string; autoFocus?: boolean; className?: string; boton?: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const [texto, setTexto] = useState(params.get("q") ?? "");
  const [cargando, start] = useTransition();
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);

  const ir = (q: string) => {
    const nuevos = new URLSearchParams(params);
    if (q.trim()) nuevos.set("q", q.trim()); else nuevos.delete("q");
    // Al buscar se descartan avisos viejos de la URL.
    nuevos.delete("ok"); nuevos.delete("error");
    const qs = nuevos.toString();
    start(() => router.replace(qs ? `${ruta}?${qs}` : ruta, { scroll: false }));
  };

  useEffect(() => () => clearTimeout(espera.current), []);

  return (
    <form
      className={`${className} viva`}
      role="search"
      data-cargando={cargando || undefined}
      onSubmit={(e) => { e.preventDefault(); clearTimeout(espera.current); ir(texto); }}
    >
      {cargando ? <Loader2 className="girando" /> : <Search />}
      <input
        name="q"
        value={texto}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          const q = e.target.value;
          setTexto(q);
          clearTimeout(espera.current);
          espera.current = setTimeout(() => ir(q), 220);
        }}
      />
      {texto && (
        <button type="button" className="limpiar" aria-label="Borrar búsqueda" onClick={() => { setTexto(""); clearTimeout(espera.current); ir(""); }}>
          <X />
        </button>
      )}
      {boton && <button className="btn lg" type="submit">{boton}</button>}
    </form>
  );
}
