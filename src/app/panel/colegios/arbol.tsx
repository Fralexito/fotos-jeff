"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Search } from "lucide-react";
import { ESTADO_PEDIDO, S, TIPO_CAMPANA } from "@/lib/formato";
import { salon, type AlumnoFila } from "@/lib/datos";
import { NOMBRE_SEDE, NOMBRE_ZONA } from "@/lib/sedes";

export type ColegioArbol = {
  id: string; nombre: string; codigo: string; ciudad: string; director: string | null; sede: string; zona: string;
  campanas: { id: string; nombre: string; anio: number; tipo: string; estado: string }[];
};
type Alumno = Pick<AlumnoFila, "id" | "codigo" | "nombres" | "apellidos" | "grado" | "seccion" | "apoderado" | "telefono" | "campanaId" | "colegioId" | "anio" | "pedidos" | "estado" | "saldo" | "total">;

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Lista de colegios; al abrir uno se ven sus campañas, salones y alumnos.
export function ArbolColegios({ colegios, alumnos, anios }: { colegios: ColegioArbol[]; alumnos: Alumno[]; anios: number[] }) {
  const [q, setQ] = useState("");
  const [anio, setAnio] = useState<number | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const busca = sinTildes(q.trim());
  const porColegio = useMemo(() => {
    const m = new Map<string, Alumno[]>();
    for (const a of alumnos) {
      if (anio && a.anio !== anio) continue;
      if (busca && !sinTildes(`${a.apellidos} ${a.nombres} ${a.codigo} ${a.apoderado ?? ""} ${a.telefono ?? ""}`).includes(busca)) continue;
      m.set(a.colegioId, [...(m.get(a.colegioId) ?? []), a]);
    }
    return m;
  }, [alumnos, anio, busca]);

  const visibles = colegios.filter((c) => {
    if (anio && !c.campanas.some((k) => k.anio === anio)) return false;
    if (!busca) return true;
    return porColegio.has(c.id) || sinTildes(`${c.nombre} ${c.codigo}`).includes(busca);
  });
  // Al buscar un alumno se abren solos los colegios donde aparece.
  const abierto = (id: string) => abiertos.has(id) || (!!busca && porColegio.has(id));
  const alternar = (id: string) =>
    setAbiertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <div className="arbol-barra">
        <label className="search">
          <Search className="i" />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar colegio, alumno, código o celular…" />
        </label>
        <div className="chips" role="group" aria-label="Año">
          <button type="button" className="chip" aria-pressed={anio === null} onClick={() => setAnio(null)}>Todos</button>
          {anios.map((a) => (
            <button type="button" key={a} className="chip" aria-pressed={anio === a} onClick={() => setAnio(a)}>{a}</button>
          ))}
        </div>
        <div className="arbol-todos">
          <button type="button" className="btn ghost sm" onClick={() => setAbiertos(new Set(visibles.map((c) => c.id)))}><ChevronsUpDown className="i" /> Abrir todos</button>
          <button type="button" className="btn ghost sm" onClick={() => setAbiertos(new Set())}><ChevronsDownUp className="i" /> Cerrar</button>
        </div>
      </div>

      {visibles.length === 0 && <p className="muted-text arbol-vacio">No hay resultados para “{q}”.</p>}

      <div className="arbol">
        {visibles.map((c) => {
          const lista = porColegio.get(c.id) ?? [];
          const deuda = lista.reduce((s, a) => s + a.saldo, 0);
          const salones = new Set(lista.map((a) => `${a.campanaId}|${salon(a)}`)).size;
          const open = abierto(c.id);
          return (
            <section key={c.id} className={`colegio-fila${open ? " abierto" : ""}`}>
              <button type="button" className="colegio-cab" aria-expanded={open} onClick={() => alternar(c.id)}>
                <ChevronDown className="i flecha" />
                <span className="colegio-ini" aria-hidden>{c.codigo.slice(0, 3)}</span>
                <span className="colegio-nom">
                  <b>{c.nombre}</b>
                  <small>Sede {NOMBRE_SEDE[c.sede] ?? c.sede} · {c.ciudad}{c.zona !== "ciudad" && ` (${NOMBRE_ZONA[c.zona]?.toLowerCase()})`}{c.director && ` · ${c.director}`}</small>
                </span>
                <span className="colegio-datos">
                  <span><b>{lista.length}</b> alumnos</span>
                  <span className="hide-mobile"><b>{salones}</b> {salones === 1 ? "salón" : "salones"}</span>
                  {deuda > 0 ? <span className="badge b-warn">Deben {S(deuda)}</span> : lista.length > 0 && <span className="badge b-good">Al día</span>}
                </span>
              </button>
              {open && <Contenido colegio={c} alumnos={lista} anio={anio} />}
            </section>
          );
        })}
      </div>
    </>
  );
}

function Contenido({ colegio, alumnos, anio }: { colegio: ColegioArbol; alumnos: Alumno[]; anio: number | null }) {
  const campanas = colegio.campanas.filter((k) => !anio || k.anio === anio);
  return (
    <div className="colegio-cuerpo">
      {campanas.length === 0 && <p className="muted-text">Este colegio aún no tiene campañas.</p>}
      {campanas.map((k) => {
        const suyos = alumnos.filter((a) => a.campanaId === k.id);
        const salones = new Map<string, Alumno[]>();
        for (const a of suyos) salones.set(salon(a), [...(salones.get(salon(a)) ?? []), a]);
        const orden = [...salones.entries()].sort(([x], [y]) => x.localeCompare(y, "es", { numeric: true }));
        return (
          <div key={k.id} className="campana-bloque">
            <div className="campana-cab">
              <div>
                <b>{k.nombre}</b>
                <small>{TIPO_CAMPANA[k.tipo]} {k.anio} · {suyos.length} alumnos</small>
              </div>
              <Link className="btn ghost sm" href={`/panel/campanas/${k.id}`}>Abrir campaña <ChevronRight className="i" /></Link>
            </div>
            {suyos.length === 0 ? (
              <p className="muted-text">Sin alumnos todavía. Ábrela y usa “Pegar lista”.</p>
            ) : (
              orden.map(([nombre, lista]) => (
                <div key={nombre} className="salon">
                  <div className="salon-cab"><b>{nombre}</b><span>{lista.length}</span></div>
                  <ol className="alumnos">
                    {lista
                      .sort((x, y) => x.apellidos.localeCompare(y.apellidos, "es"))
                      .map((a) => {
                        const [txt, cls] = a.estado ? ESTADO_PEDIDO[a.estado] ?? [a.estado, "b-neutral"] : ["Sin pedido", "b-neutral"];
                        return (
                          <li key={a.id}>
                            <Link href={`/panel/buscar?q=${encodeURIComponent(a.codigo)}`} className="alumno">
                              <span className="code">{a.codigo}</span>
                              <span className="alumno-nom"><b>{a.apellidos}</b>, {a.nombres}</span>
                              <span className="alumno-apo hide-mobile">{a.apoderado ?? ""}{a.telefono && <small>{a.telefono}</small>}</span>
                              <span className={`badge ${cls}`}>{txt}</span>
                              <span className={`alumno-saldo${a.saldo > 0 ? " debe" : ""}`}>
                                {a.pedidos === 0 ? "—" : a.saldo > 0 ? `Debe ${S(a.saldo)}` : "Pagado"}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                  </ol>
                </div>
              ))
            )}
          </div>
        );
      })}
      <div className="colegio-pie">
        <Link className="btn secondary sm" href={`/panel/colegios/${colegio.id}`}>Ficha del colegio <ChevronRight className="i" /></Link>
      </div>
    </div>
  );
}
