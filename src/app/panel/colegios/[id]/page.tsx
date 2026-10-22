import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { TIPO_CAMPANA, fecha } from "@/lib/formato";
import { crearCampana } from "../../actions";

const ESTADO: Record<string, [string, string]> = {
  planificada: ["Planificada", "p-info"],
  en_captura: ["En toma de fotos", "p-warn"],
  en_edicion: ["En edición", "p-warn"],
  en_entrega: ["En entrega", "p-info"],
  cerrada: ["Cerrada", "p-good"],
};

export default async function Colegio({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [{ id }, aviso] = await Promise.all([params, searchParams]);
  const { supabase } = await requirePerfil();
  const { data: colegio } = await supabase
    .from("colegios")
    .select("*, campanas(id, nombre, tipo, anio, estado, fecha_captura, alumnos(count))")
    .eq("id", id)
    .order("anio", { referencedTable: "campanas", ascending: false })
    .single();
  if (!colegio) notFound();

  const campanas = (colegio.campanas ?? []) as {
    id: string; nombre: string; tipo: string; anio: number; estado: string; fecha_captura: string | null;
    alumnos: { count: number }[];
  }[];

  return (
    <section>
      <Link className="back" href="/panel/colegios">← Colegios</Link>
      <h1>{colegio.nombre}</h1>
      <p className="lead">
        {colegio.ciudad} · código {colegio.codigo}
        {colegio.director && ` · Dir. ${colegio.director}`}
        {colegio.contacto_nombre && ` · Contacto: ${colegio.contacto_nombre}`}
        {colegio.contacto_telefono && ` (${colegio.contacto_telefono})`}
      </p>
      <Aviso {...aviso} />

      <details className="add card">
        <summary className="btn">+ Nueva campaña</summary>
        <form action={crearCampana} className="stack">
          <input type="hidden" name="colegio_id" value={colegio.id} />
          <div className="fields">
            <label className="f">Nombre<input name="nombre" required placeholder="Promoción 2026 - 5.º secundaria" /></label>
            <label className="f">
              Tipo
              <select name="tipo" defaultValue="promocion">
                {Object.entries(TIPO_CAMPANA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
            <label className="f">Año<input name="anio" type="number" required defaultValue={new Date().getFullYear()} /></label>
            <label className="f">Día de la toma<input name="fecha_captura" type="date" /></label>
            <label className="f">Día de entrega<input name="fecha_entrega" type="date" /></label>
          </div>
          <div><button className="btn" type="submit">Guardar campaña</button></div>
        </form>
      </details>

      <div className="card">
        <h2>Campañas</h2>
        {campanas.length === 0 && <p className="empty">Este colegio aún no tiene campañas.</p>}
        {campanas.map((c) => {
          const [texto, clase] = ESTADO[c.estado] ?? [c.estado, "p-info"];
          return (
            <div className="row" key={c.id}>
              <Link className="grow" href={`/panel/campanas/${c.id}`}>
                <b>{c.nombre}</b>
                <div className="sub">
                  {TIPO_CAMPANA[c.tipo]} · {c.alumnos[0]?.count ?? 0} alumnos
                  {c.fecha_captura && ` · toma el ${fecha(c.fecha_captura + "T12:00:00-05:00")}`}
                </div>
              </Link>
              <span className={`pill ${clase}`}>{texto}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
