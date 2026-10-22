"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, PhoneOff, RotateCcw, Search, Send } from "lucide-react";
import { S, whatsapp } from "@/lib/formato";

export type Familia = {
  clave: string; telefono: string | null; colegios: string[]; saldo: number;
  pedidos: { alumnoId: string; numero: number; alumno: string; saldo: number; salon: string }[];
};

const PLANTILLA =
  "Hola, le saluda Fotos Jefferson. Le recordamos que tiene un saldo pendiente de {total} por {detalle}. Puede pagar por Yape o Plin, o en nuestro local. ¡Muchas gracias!";
const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const primerNombre = (alumno: string) => (alumno.split(", ")[1] ?? alumno).split(" ")[0];

function mensaje(plantilla: string, f: Familia) {
  const detalle = f.pedidos.map((p) => `el pedido N.º ${p.numero} de ${primerNombre(p.alumno)} (${S(p.saldo)})`).join(", ");
  return plantilla.replaceAll("{total}", S(f.saldo)).replaceAll("{detalle}", detalle);
}

// Lista con casillas y un botón que abre el WhatsApp del siguiente apoderado de la cola.
// Los navegadores no dejan abrir muchos chats a la vez, por eso se envía uno por uno.
export function Lote({ familias }: { familias: Familia[] }) {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  const memoria = `cobro-wa-${hoy}`;
  const [q, setQ] = useState("");
  const [colegio, setColegio] = useState("");
  const [plantilla, setPlantilla] = useState(PLANTILLA);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [enviados, setEnviados] = useState<Set<string>>(new Set());

  // Recuerda (solo en este equipo y solo hoy) a quiénes ya se les escribió.
  useEffect(() => {
    try {
      setEnviados(new Set(JSON.parse(localStorage.getItem(memoria) ?? "[]")));
    } catch {}
  }, [memoria]);
  const marcar = (clave: string) =>
    setEnviados((s) => {
      const n = new Set(s).add(clave);
      try { localStorage.setItem(memoria, JSON.stringify([...n])); } catch {}
      return n;
    });
  const olvidar = () => {
    setEnviados(new Set());
    try { localStorage.removeItem(memoria); } catch {}
  };

  const colegios = useMemo(() => [...new Set(familias.flatMap((f) => f.colegios))].filter(Boolean).sort((a, b) => a.localeCompare(b, "es")), [familias]);
  const busca = sinTildes(q.trim());
  const visibles = familias.filter(
    (f) =>
      (!colegio || f.colegios.includes(colegio)) &&
      (!busca || sinTildes(f.pedidos.map((p) => p.alumno).join(" ") + " " + (f.telefono ?? "")).includes(busca)),
  );
  const conCelular = visibles.filter((f) => f.telefono);
  const sinCelular = visibles.filter((f) => !f.telefono);
  const cola = conCelular.filter((f) => elegidos.has(f.clave) && !enviados.has(f.clave));
  const siguiente = cola[0];
  const totalElegido = conCelular.filter((f) => elegidos.has(f.clave)).reduce((s, f) => s + f.saldo, 0);
  const todos = conCelular.length > 0 && conCelular.every((f) => elegidos.has(f.clave));

  const alternar = (clave: string) =>
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });

  return (
    <div className="lote">
      <div className="card lote-mensaje">
        <label className="field">
          Mensaje
          <textarea className="input" rows={3} value={plantilla} onChange={(e) => setPlantilla(e.target.value)} />
        </label>
        <p className="muted-text">
          <b>{"{total}"}</b> se cambia por lo que debe y <b>{"{detalle}"}</b> por sus pedidos.{" "}
          {plantilla !== PLANTILLA && <button type="button" className="btn ghost sm" onClick={() => setPlantilla(PLANTILLA)}><RotateCcw className="i" /> Mensaje original</button>}
        </p>
      </div>

      <div className="lote-enviar" aria-live="polite">
        {siguiente ? (
          <>
            <span><b>{cola.length}</b> por enviar · {S(totalElegido)} en total</span>
            <a
              className="btn wa lg"
              href={whatsapp(siguiente.telefono, mensaje(plantilla, siguiente)) ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => marcar(siguiente.clave)}
            >
              <Send className="i" /> Enviar a {primerNombre(siguiente.pedidos[0].alumno)}{siguiente.pedidos.length > 1 && ` y ${siguiente.pedidos.length - 1} más`}
            </a>
          </>
        ) : elegidos.size > 0 ? (
          <span className="ok-text"><Check className="i" /> Listo, ya se les escribió a todos los elegidos.</span>
        ) : (
          <span>Marca a quiénes quieres escribir. Luego toca <b>Enviar</b> una vez por cada uno.</span>
        )}
        {enviados.size > 0 && <button type="button" className="btn ghost sm" onClick={olvidar}>Empezar de nuevo</button>}
      </div>

      <div className="arbol-barra">
        <label className="search">
          <Search className="i" />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar alumno o celular…" />
        </label>
        <select className="input lote-colegio" value={colegio} onChange={(e) => setColegio(e.target.value)} aria-label="Colegio">
          <option value="">Todos los colegios</option>
          {colegios.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="card-head">
          <label className="check">
            <input type="checkbox" checked={todos} onChange={() => setElegidos(todos ? new Set() : new Set(conCelular.map((f) => f.clave)))} />
            <b>Elegir todos ({conCelular.length})</b>
          </label>
        </div>
        {conCelular.length === 0 && <p className="muted-text arbol-vacio">Nadie con celular debe dinero aquí.</p>}
        <ul className="list">
          {conCelular.map((f) => {
            const hecho = enviados.has(f.clave);
            return (
              <li key={f.clave} className={`item lote-fila${hecho ? " enviado" : ""}`}>
                <label className="check lote-check">
                  <input type="checkbox" checked={elegidos.has(f.clave)} onChange={() => alternar(f.clave)} />
                  <span>
                    <b>{f.pedidos.map((p) => p.alumno).join(" · ")}</b>
                    <small>{f.colegios.join(", ")} · {f.telefono}</small>
                  </span>
                </label>
                <span className="lote-saldo">{S(f.saldo)}</span>
                {hecho ? (
                  <span className="badge b-good"><Check className="i" /> Enviado</span>
                ) : (
                  <a className="btn wa sm" href={whatsapp(f.telefono, mensaje(plantilla, f)) ?? "#"} target="_blank" rel="noopener noreferrer" onClick={() => marcar(f.clave)}>
                    <Send className="i" /> Enviar
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {sinCelular.length > 0 && (
        <div className="card">
          <div className="card-head"><h2><PhoneOff className="i" /> Sin celular ({sinCelular.length})</h2><p>Agrega el celular del apoderado en la ficha del alumno.</p></div>
          <ul className="list">
            {sinCelular.map((f) => (
              <li key={f.clave}>
                <Link className="item" href={`/panel/alumnos/${f.pedidos[0].alumnoId}`}>
                <span className="lote-check"><span><b>{f.pedidos[0].alumno}</b><small>{f.colegios.join(", ")} · Agregar celular</small></span></span>
                <span className="lote-saldo">{S(f.saldo)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
