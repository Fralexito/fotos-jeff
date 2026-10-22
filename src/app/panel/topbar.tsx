"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HandCoins, Package, Plus, School, Search, Settings } from "lucide-react";

// Barra superior: búsqueda en todo el sistema (atajo "/"), menú Nuevo y acceso a Ajustes.
export function Topbar({ cobros, catalogo }: { cobros: boolean; catalogo: boolean }) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => setAbierto(false), [ruta]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const escribiendo = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (e.key === "/" && !escribiendo) {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape") setAbierto(false);
    };
    const fuera = (e: MouseEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node)) setAbierto(false);
    };
    addEventListener("keydown", tecla);
    addEventListener("mousedown", fuera);
    return () => {
      removeEventListener("keydown", tecla);
      removeEventListener("mousedown", fuera);
    };
  }, []);

  return (
    <div className="topbar">
      <form
        className="topsearch"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const q = input.current?.value.trim();
          if (q) router.push(`/panel/buscar?q=${encodeURIComponent(q)}`);
        }}
      >
        <Search className="i" />
        <input
          ref={input}
          key={ruta === "/panel/buscar" ? params.get("q") : "x"}
          defaultValue={ruta === "/panel/buscar" ? params.get("q") ?? "" : ""}
          placeholder="Buscar alumno, código o colegio"
          aria-label="Buscar en todo el sistema"
        />
        <kbd>/</kbd>
      </form>
      <div className="topactions">
        <div className="menu-wrap" ref={menu}>
          <button type="button" className="btn" aria-expanded={abierto} aria-haspopup="menu" onClick={() => setAbierto((v) => !v)}>
            <Plus className="i" /> <span className="hide-sm">Nuevo</span>
          </button>
          <div className="menu" role="menu" data-open={abierto || undefined}>
            <Link role="menuitem" href="/panel/colegios?nuevo=1">
              <span className="ico"><School className="i" /></span>
              <span><b>Colegio</b><small>Registrar un colegio nuevo</small></span>
            </Link>
            {cobros && (
              <Link role="menuitem" href="/panel/cobros">
                <span className="ico"><HandCoins className="i" /></span>
                <span><b>Pago</b><small>Buscar al alumno y cobrar</small></span>
              </Link>
            )}
            {catalogo && (
              <Link role="menuitem" href="/panel/catalogo?nuevo=1">
                <span className="ico"><Package className="i" /></span>
                <span><b>Producto</b><small>Agregar al catálogo</small></span>
              </Link>
            )}
          </div>
        </div>
        <Link href="/panel/ajustes" className="icon-btn lg" aria-label="Ajustes" title="Ajustes" aria-current={ruta === "/panel/ajustes" ? "page" : undefined}>
          <Settings className="i" />
        </Link>
      </div>
    </div>
  );
}
