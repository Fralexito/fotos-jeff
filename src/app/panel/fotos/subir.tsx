"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Alumno = { id: string; codigo: string };

// Sube las fotos directo al almacenamiento (sin pasar por el servidor) y las deja en la cola del motor.
// Si el archivo se llama como el código del alumno (p. ej. 7KQ4PZ.jpg) queda asociado solo.
export function SubirFotos({ campanaId, alumnos, medidas }: { campanaId: string; alumnos: Alumno[]; medidas: string[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [elegidas, setElegidas] = useState<string[]>(medidas.slice(0, 1));
  const [arrastrando, setArrastrando] = useState(false);
  const [progreso, setProgreso] = useState<{ hechas: number; total: number; errores: string[] } | null>(null);

  const porCodigo = new Map(alumnos.map((a) => [a.codigo.toUpperCase(), a.id]));

  async function subir(archivos: File[]) {
    const fotos = archivos.filter((f) => /^image\/(jpeg|png|webp|heic|heif)$/.test(f.type) || /\.(jpe?g|png|heic|webp)$/i.test(f.name));
    if (fotos.length === 0 || elegidas.length === 0) return;
    const supabase = createClient();
    const estado = { hechas: 0, total: fotos.length, errores: [] as string[] };
    setProgreso({ ...estado });
    const cola = [...fotos];
    const trabajador = async () => {
      for (let f = cola.shift(); f; f = cola.shift()) {
        const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase();
        const ruta = `${campanaId}/${crypto.randomUUID()}.${ext}`;
        const codigo = f.name.replace(/\.[^.]+$/, "").trim().toUpperCase();
        const { error: e1 } = await supabase.storage.from("originales").upload(ruta, f, { contentType: f.type || "image/jpeg" });
        const { error: e2 } = e1
          ? { error: e1 }
          : await supabase.from("fotos").insert({
              campana_id: campanaId, alumno_id: porCodigo.get(codigo) ?? null, ruta_original: ruta,
              producto: elegidas.join(","), estado: "subida",
            });
        if (e2) estado.errores.push(f.name);
        estado.hechas++;
        setProgreso({ ...estado });
      }
    };
    await Promise.all([trabajador(), trabajador(), trabajador()]);
    router.refresh();
    setTimeout(() => setProgreso((p) => (p && p.errores.length === 0 ? null : p)), 2500);
  }

  const subiendo = progreso && progreso.hechas < progreso.total;
  return (
    <div className="subir">
      <div className="subir-medidas">
        <span>Medidas a sacar</span>
        <div className="chips" role="group" aria-label="Medidas">
          {medidas.map((m) => (
            <button
              key={m} type="button" className="chip"
              aria-pressed={elegidas.includes(m)}
              onClick={() => setElegidas((e) => (e.includes(m) ? e.filter((x) => x !== m) : [...e, m]))}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className={`subir-zona${arrastrando ? " sobre" : ""}`}
        disabled={!!subiendo || elegidas.length === 0}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastrando(false); subir([...e.dataTransfer.files]); }}
      >
        {subiendo ? <LoaderCircle className="i girando" /> : <ImageUp className="i" />}
        <b>{subiendo ? `Subiendo ${progreso.hechas} de ${progreso.total}…` : "Toca o arrastra las fotos aquí"}</b>
        <small>
          {elegidas.length === 0 ? "Elige al menos una medida." : "Si el archivo se llama como el código del alumno, se asocia solo."}
        </small>
        {progreso && <span className="subir-barra" style={{ "--p": `${(progreso.hechas / progreso.total) * 100}%` } as React.CSSProperties} />}
      </button>
      {progreso && !subiendo && (
        <p className={progreso.errores.length ? "subir-msg mal" : "subir-msg"}>
          {progreso.errores.length
            ? `No se pudieron subir: ${progreso.errores.join(", ")}`
            : `${progreso.total} ${progreso.total === 1 ? "foto subida" : "fotos subidas"}. El motor del estudio las edita solo.`}
        </p>
      )}
      <input
        ref={input} type="file" accept="image/*" multiple hidden
        onChange={(e) => { subir([...(e.target.files ?? [])]); e.target.value = ""; }}
      />
    </div>
  );
}

// Mientras haya fotos en la cola, la pantalla se actualiza sola.
export function Refrescar({ activo }: { activo: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [activo, router]);
  return null;
}

export function ElegirCampana({ campanas, actual, ver }: { campanas: { id: string; texto: string }[]; actual: string; ver: string }) {
  const router = useRouter();
  return (
    <select className="input elegir-campana" value={actual} aria-label="Campaña" onChange={(e) => router.push(`/panel/fotos?campana=${e.target.value}&ver=${ver}`)}>
      {campanas.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
    </select>
  );
}
