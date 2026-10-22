"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { OPCIONES, type Preferencias } from "@/lib/preferencias";
import { guardarPreferencias } from "./actions";
import { Boxes, HandCoins, Handshake, ListTodo, MapPin, Package, Plus, Receipt, School, Search, Settings } from "lucide-react";

// Barra superior: búsqueda en todo el sistema (atajo "/"), menú Nuevo y acceso a Ajustes.
export function Topbar({ cobros, catalogo, clientes, prefs }: { cobros: boolean; catalogo: boolean; clientes: boolean; prefs: Preferencias }) {
  const router = useRouter();
  const [sencilla, setSencilla] = useState(prefs.vista === "sencilla");
  const [, start] = useTransition();
  const cambiarVista = () => {
    const nueva = !sencilla;
    setSencilla(nueva);
    const app = document.querySelector<HTMLElement>(".app");
    if (app) app.dataset.vista = nueva ? "sencilla" : "completa";
    start(async () => {
      await guardarPreferencias({ ...prefs, sede, vista: nueva ? "sencilla" : "completa" });
      router.refresh();
    });
  };
  const [sede, setSede] = useState(prefs.sede);
  const cambiarSede = (nueva: Preferencias["sede"]) => {
    setSede(nueva);
    start(async () => {
      await guardarPreferencias({ ...prefs, vista: sencilla ? "sencilla" : "completa", sede: nueva });
      router.refresh();
    });
  };
  const ruta = usePathname();
  const params = useSearchParams();
  const input = useRef<HTMLInputElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Resultados mientras se escribe: lleva a Buscar y actualiza la lista sin perder lo escrito.
  const buscarVivo = (q: string) => {
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      const t = q.trim();
      if (!t && ruta !== "/panel/buscar") return;
      const destino = t ? `/panel/buscar?q=${encodeURIComponent(t)}` : "/panel/buscar";
      if (ruta === "/panel/buscar") router.replace(destino, { scroll: false }); else router.push(destino);
    }, 250);
  };
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
          defaultValue={ruta === "/panel/buscar" ? params.get("q") ?? "" : ""}
          onChange={(e) => buscarVivo(e.target.value)}
          autoComplete="off"
          placeholder="Buscar alumno, código o colegio"
          aria-label="Buscar en todo el sistema"
        />
        <kbd>/</kbd>
      </form>
      <div className="topactions">
        <label className="sede-pick" title="Ver solo una sede">
          <MapPin className="i" />
          <select value={sede} onChange={(e) => cambiarSede(e.target.value as Preferencias["sede"])} aria-label="Sede">
            {OPCIONES.sede.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
          </select>
        </label>
        <button type="button" className="switch" role="switch" aria-checked={sencilla} onClick={cambiarVista} title="Vista sencilla: solo lo esencial, con botones grandes">
          <span className="track"><span className="thumb" /></span>
          <span className="hide-sm">Vista sencilla</span>
        </button>
        <div className="menu-wrap" ref={menu}>
          <button type="button" className="btn" aria-expanded={abierto} aria-haspopup="menu" onClick={() => setAbierto((v) => !v)}>
            <Plus className="i" /> <span className="hide-sm">Nuevo</span>
          </button>
          <div className="menu" role="menu" data-open={abierto || undefined}>
            {clientes && (
              <>
                <Link role="menuitem" href="/panel/clientes?nuevo=oportunidad">
                  <span className="ico"><Handshake className="i" /></span>
                  <span><b>Oportunidad</b><small>Un colegio por conseguir</small></span>
                </Link>
                <Link role="menuitem" href="/panel/clientes?vista=tareas&nuevo=tarea">
                  <span className="ico"><ListTodo className="i" /></span>
                  <span><b>Recordatorio</b><small>Llamar, visitar, cobrar…</small></span>
                </Link>
              </>
            )}
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
            {cobros && (
              <Link role="menuitem" href="/panel/caja?nuevo=1">
                <span className="ico"><Receipt className="i" /></span>
                <span><b>Gasto</b><small>Anotar una salida de dinero</small></span>
              </Link>
            )}
            <Link role="menuitem" href="/panel/inventario?nuevo=1">
              <span className="ico"><Boxes className="i" /></span>
              <span><b>Material</b><small>Papel, marcos, tinta…</small></span>
            </Link>
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
