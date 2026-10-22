"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send, Sparkles } from "lucide-react";
import { preguntar, type Mensaje } from "./acciones";

const SUGERENCIAS = [
  "¿Cuánto llevamos cobrado este mes y cuánto falta para la meta?",
  "¿Quiénes deben más y a qué colegio pertenecen?",
  "¿Qué tomas y entregas tenemos esta semana?",
  "¿Qué sede va mejor este mes?",
  "Dame 3 ideas para cobrar los saldos pendientes",
];

export function Chat({ nombre }: { nombre: string }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [pensando, iniciar] = useTransition();
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => { fin.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [mensajes, pensando]);

  function enviar(pregunta: string) {
    const q = pregunta.trim();
    if (!q || pensando) return;
    const nuevo: Mensaje[] = [...mensajes, { rol: "usuario", texto: q }];
    setMensajes(nuevo);
    setTexto("");
    setError("");
    iniciar(async () => {
      const r = await preguntar(nuevo);
      if (r.texto) setMensajes([...nuevo, { rol: "asistente", texto: r.texto }]);
      else setError(r.error ?? "Algo salió mal.");
    });
  }

  return (
    <div className="card chat">
      <div className="chat-mensajes" aria-live="polite">
        {mensajes.length === 0 && (
          <div className="chat-vacio">
            <span className="chat-logo"><Sparkles /></span>
            <h2>Hola, {nombre}. ¿Qué quieres saber del negocio?</h2>
            <p>Respondo con los datos del panel: cobros, deudores, campañas, caja, materiales y equipos.</p>
            <div className="chat-sugerencias">
              {SUGERENCIAS.map((s) => <button key={s} type="button" onClick={() => enviar(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {mensajes.map((m, i) => (
          <div key={i} className={`burbuja ${m.rol}`}>{m.texto}</div>
        ))}
        {pensando && <div className="burbuja asistente pensando"><span /><span /><span /></div>}
        {error && <div className="notice err" role="alert">{error}</div>}
        <div ref={fin} />
      </div>
      <form className="chat-caja" onSubmit={(e) => { e.preventDefault(); enviar(texto); }}>
        <textarea
          className="input" rows={1} value={texto} placeholder="Escribe tu pregunta…" aria-label="Pregunta"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(texto); } }}
        />
        <button className="btn" type="submit" disabled={pensando || !texto.trim()} aria-label="Enviar"><Send className="i" /></button>
      </form>
    </div>
  );
}
