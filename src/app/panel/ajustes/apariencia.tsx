"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { OPCIONES, type Clave, type Preferencias } from "@/lib/preferencias";
import { guardarPreferencias } from "../actions";

const GRUPOS: { clave: Exclude<Clave, "color">; titulo: string; ayuda: string }[] = [
  { clave: "vista", titulo: "Vista", ayuda: "Sencilla muestra solo lo esencial, con botones grandes. Completa muestra todas las secciones y detalles." },
  { clave: "tema", titulo: "Modo", ayuda: "Oscuro descansa la vista de noche." },
  { clave: "letra", titulo: "Tamaño de letra", ayuda: "Más grande se lee mejor en pantallas pequeñas." },
  { clave: "densidad", titulo: "Espacio entre filas", ayuda: "Compacta muestra más alumnos y pedidos a la vez." },
];

// Cambia el aspecto al instante (vista previa) y lo guarda en el perfil de la persona.
export function Apariencia({ inicial }: { inicial: Preferencias }) {
  const [prefs, setPrefs] = useState(inicial);
  const [guardando, start] = useTransition();
  const [estado, setEstado] = useState<"" | "ok" | "error">("");
  const router = useRouter();

  function cambiar<K extends Clave>(clave: K, valor: Preferencias[K]) {
    const nuevas = { ...prefs, [clave]: valor };
    setPrefs(nuevas);
    const app = document.querySelector<HTMLElement>(".app");
    if (app) app.dataset[clave] = valor;
    start(async () => {
      const r = await guardarPreferencias(nuevas);
      setEstado(r.error ? "error" : "ok");
      if (clave === "vista") router.refresh();
    });
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Apariencia</h2>
          <p>Solo cambia cómo lo ves tú. Cada persona del equipo tiene la suya.</p>
        </div>
        <span className={`save-state ${estado}`} aria-live="polite">
          {guardando ? (
            <><LoaderCircle className="i spin" /> Guardando</>
          ) : estado === "ok" ? (
            <><Check className="i" /> Guardado</>
          ) : estado === "error" ? (
            "No se pudo guardar"
          ) : null}
        </span>
      </div>
      <div className="card-body prefs">
        <fieldset className="pref">
          <legend>Color principal</legend>
          <div className="swatches">
            {OPCIONES.color.map((o) => (
              <label key={o.valor} className="swatch" style={{ "--sw": o.muestra } as React.CSSProperties}>
                <input type="radio" name="color" checked={prefs.color === o.valor} onChange={() => cambiar("color", o.valor)} />
                <span className="dot"><Check className="i" /></span>
                {o.texto}
              </label>
            ))}
          </div>
        </fieldset>
        {GRUPOS.map(({ clave, titulo, ayuda }) => (
          <fieldset className="pref" key={clave}>
            <legend>{titulo}</legend>
            <p className="hint">{ayuda}</p>
            <div className="segmented">
              {OPCIONES[clave].map((o) => (
                <label key={o.valor}>
                  <input
                    type="radio"
                    name={clave}
                    checked={prefs[clave] === o.valor}
                    onChange={() => cambiar(clave, o.valor as Preferencias[typeof clave])}
                  />
                  <span>{o.texto}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
