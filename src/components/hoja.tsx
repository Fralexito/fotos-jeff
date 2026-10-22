"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FilterX, Search } from "lucide-react";
import { S } from "@/lib/formato";

export type Columna = {
  key: string;
  label: string;
  tipo?: "texto" | "num" | "soles" | "fecha" | "codigo";
  badges?: Record<string, string>; // texto → clase del badge; además el filtro se vuelve una lista
  ancho?: number;
};
export type Celda = string | number | null;
export type FilaHoja = Record<string, Celda> & { _href?: string | null };

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fechaCorta = (d: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
const POR_PAGINA = 300;

function hoyLima() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}
function rango(r: "hoy" | "semana" | "mes" | "anio"): [string, string] {
  const hoy = hoyLima();
  const d = new Date(hoy + "T12:00:00");
  if (r === "hoy") return [hoy, hoy];
  if (r === "semana") {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return [d.toISOString().slice(0, 10), hoy];
  }
  if (r === "mes") return [hoy.slice(0, 8) + "01", hoy];
  return [hoy.slice(0, 5) + "01-01", hoy];
}

// Hoja tipo Excel: ordenar por columna, filtrar por columna y por fechas, totales y descarga.
export function Hoja({ columnas, filas, archivo, fecha }: { columnas: Columna[]; filas: FilaHoja[]; archivo: string; fecha?: string }) {
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [orden, setOrden] = useState<{ key: string; asc: boolean } | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  const opciones = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const c of columnas)
      if (c.badges) m[c.key] = [...new Set(filas.map((f) => String(f[c.key] ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    return m;
  }, [columnas, filas]);

  const vistas = useMemo(() => {
    const busca = sinTildes(q.trim());
    const activos = Object.entries(filtros).filter(([, v]) => v.trim());
    let r = filas.filter((f) => {
      if (fecha) {
        const d = String(f[fecha] ?? "");
        if (desde && d < desde) return false;
        if (hasta && d > hasta) return false;
      }
      for (const [k, v] of activos) {
        const col = columnas.find((c) => c.key === k);
        const valor = String(f[k] ?? "");
        if (col?.badges ? valor !== v : !sinTildes(col?.tipo === "fecha" ? fechaCorta(valor) : valor).includes(sinTildes(v.trim()))) return false;
      }
      if (busca && !sinTildes(columnas.map((c) => f[c.key] ?? "").join(" ")).includes(busca)) return false;
      return true;
    });
    if (orden) {
      const col = columnas.find((c) => c.key === orden.key);
      const numerico = col?.tipo === "num" || col?.tipo === "soles";
      r = [...r].sort((a, b) => {
        const x = a[orden.key], y = b[orden.key];
        if (x === null || x === "") return 1;
        if (y === null || y === "") return -1;
        const c = numerico ? Number(x) - Number(y) : String(x).localeCompare(String(y), "es", { numeric: true });
        return orden.asc ? c : -c;
      });
    }
    return r;
  }, [filas, columnas, q, filtros, orden, desde, hasta, fecha]);

  const totales = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of columnas) if (c.tipo === "soles" || c.tipo === "num") t[c.key] = vistas.reduce((s, f) => s + Number(f[c.key] ?? 0), 0);
    return t;
  }, [columnas, vistas]);

  const hayFiltros = !!q || !!desde || !!hasta || Object.values(filtros).some(Boolean) || !!orden;
  const limpiar = () => { setQ(""); setFiltros({}); setDesde(""); setHasta(""); setOrden(null); };
  const ordenar = (key: string) =>
    setOrden((o) => (o?.key !== key ? { key, asc: true } : o.asc ? { key, asc: false } : null));

  const descargar = () => {
    const celda = (v: Celda) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      columnas.map((c) => celda(c.label)).join(";"),
      ...vistas.map((f) =>
        columnas
          .map((c) => {
            const v = f[c.key];
            if (c.tipo === "soles") return celda(Number(v ?? 0).toFixed(2));
            if (c.tipo === "fecha") return celda(fechaCorta(String(v ?? "")));
            return celda(v);
          })
          .join(";"),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${archivo}-${hoyLima()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mostrar = (c: Columna, v: Celda) => {
    if (v === null || v === "") return <span className="vacio">—</span>;
    if (c.tipo === "soles") return S(v);
    if (c.tipo === "fecha") return fechaCorta(String(v));
    if (c.tipo === "codigo") return <span className="code">{v}</span>;
    if (c.badges) return <span className={`badge ${c.badges[String(v)] ?? "b-neutral"}`}>{v}</span>;
    return v;
  };

  return (
    <div className="hoja">
      <div className="hoja-barra">
        <label className="search">
          <Search className="i" />
          <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setLimite(POR_PAGINA); }} placeholder="Buscar en toda la tabla…" />
        </label>
        {fecha && (
          <div className="hoja-fechas">
            <div className="chips" role="group" aria-label="Periodo">
              {([["hoy", "Hoy"], ["semana", "Semana"], ["mes", "Mes"], ["anio", "Año"]] as const).map(([k, t]) => {
                const [a, b] = rango(k);
                return (
                  <button key={k} type="button" className="chip" aria-pressed={desde === a && hasta === b} onClick={() => { setDesde(a); setHasta(b); }}>{t}</button>
                );
              })}
            </div>
            <label>Desde<input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
            <label>Hasta<input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          </div>
        )}
        <div className="hoja-acciones">
          {hayFiltros && <button type="button" className="btn ghost sm" onClick={limpiar}><FilterX className="i" /> Quitar filtros</button>}
          <button type="button" className="btn secondary sm" onClick={descargar}><Download className="i" /> Descargar Excel</button>
        </div>
      </div>

      <div className="hoja-marco">
        <table className="hoja-tabla">
          <thead>
            <tr>
              <th className="n">#</th>
              {columnas.map((c) => {
                const activo = orden?.key === c.key;
                const Flecha = !activo ? ArrowUpDown : orden.asc ? ArrowUp : ArrowDown;
                return (
                  <th key={c.key} className={c.tipo === "soles" || c.tipo === "num" ? "der" : undefined} style={c.ancho ? { minWidth: c.ancho } : undefined} aria-sort={activo ? (orden.asc ? "ascending" : "descending") : undefined}>
                    <button type="button" onClick={() => ordenar(c.key)} className={activo ? "activo" : undefined}>
                      {c.label}<Flecha className="i" />
                    </button>
                  </th>
                );
              })}
            </tr>
            <tr className="filtros">
              <th className="n" />
              {columnas.map((c) => (
                <th key={c.key}>
                  {c.badges ? (
                    <select value={filtros[c.key] ?? ""} onChange={(e) => setFiltros({ ...filtros, [c.key]: e.target.value })} aria-label={`Filtrar ${c.label}`}>
                      <option value="">Todos</option>
                      {opciones[c.key]?.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input size={1} value={filtros[c.key] ?? ""} onChange={(e) => setFiltros({ ...filtros, [c.key]: e.target.value })} placeholder="Filtrar" aria-label={`Filtrar ${c.label}`} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vistas.slice(0, limite).map((f, i) => (
              <tr key={i}>
                <td className="n">{f._href ? <Link href={f._href}>{i + 1}</Link> : i + 1}</td>
                {columnas.map((c) => (
                  <td key={c.key} className={c.tipo === "soles" || c.tipo === "num" ? "der" : undefined}>{mostrar(c, f[c.key])}</td>
                ))}
              </tr>
            ))}
            {vistas.length === 0 && (
              <tr><td className="hoja-vacia" colSpan={columnas.length + 1}>No hay filas con esos filtros.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="n">Σ</td>
              {columnas.map((c, i) => (
                <td key={c.key} className={c.key in totales ? "der" : undefined}>
                  {i === 0 ? <b>{vistas.length} {vistas.length === 1 ? "fila" : "filas"}</b> : c.key in totales ? <b>{c.tipo === "soles" ? S(totales[c.key]) : totales[c.key]}</b> : null}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {vistas.length > limite && (
        <div className="hoja-mas">
          <button type="button" className="btn secondary sm" onClick={() => setLimite((l) => l + POR_PAGINA)}>
            Mostrar {Math.min(POR_PAGINA, vistas.length - limite)} más (de {vistas.length})
          </button>
        </div>
      )}
    </div>
  );
}
