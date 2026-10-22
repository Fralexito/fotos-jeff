import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, ChevronRight, FolderOpen } from "lucide-react";
import { requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Empty, PageHeader } from "@/components/ui";
import { TIPO_CAMPANA, fecha } from "@/lib/formato";
import { crearCampana } from "../../actions";

const ESTADO: Record<string, [string, string]> = {
  planificada: ["Planificada", "b-neutral"],
  en_captura: ["En toma de fotos", "b-warn"],
  en_edicion: ["En edición", "b-warn"],
  en_entrega: ["En entrega", "b-info"],
  cerrada: ["Cerrada", "b-good"],
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
    .select("*, campanas(id, nombre, tipo, anio, estado, fecha_captura, fecha_entrega, alumnos(count))")
    .eq("id", id)
    .order("anio", { referencedTable: "campanas", ascending: false })
    .single();
  if (!colegio) notFound();

  const campanas = (colegio.campanas ?? []) as {
    id: string; nombre: string; tipo: string; anio: number; estado: string;
    fecha_captura: string | null; fecha_entrega: string | null; alumnos: { count: number }[];
  }[];
  const dia = (d: string | null) => (d ? fecha(d + "T12:00:00-05:00") : "—");

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/panel/colegios", label: "Colegios" }]}
        title={colegio.nombre}
        subtitle={`${colegio.ciudad} · código ${colegio.codigo}`}
        actions={
          <Modal label="Nueva campaña" title="Nueva campaña" icon={<CalendarPlus className="i" />}>
            <form action={crearCampana} className="form">
              <input type="hidden" name="colegio_id" value={colegio.id} />
              <div className="fields">
                <label className="field" style={{ gridColumn: "1 / -1" }}>Nombre<input name="nombre" required placeholder="Promoción 2026 - 5.º secundaria" /></label>
                <label className="field">
                  Tipo
                  <select name="tipo" defaultValue="promocion">
                    {Object.entries(TIPO_CAMPANA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
                <label className="field">Año<input name="anio" type="number" required defaultValue={new Date().getFullYear()} /></label>
                <label className="field">Día de la toma<input name="fecha_captura" type="date" /></label>
                <label className="field">Día de entrega<input name="fecha_entrega" type="date" /></label>
              </div>
              <div className="form-foot"><button className="btn" type="submit">Guardar campaña</button></div>
            </form>
          </Modal>
        }
      />
      <Aviso {...aviso} />

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2>Campañas</h2></div>
          {campanas.length === 0 ? (
            <Empty icon={FolderOpen} title="Sin campañas">Crea la primera con “Nueva campaña”.</Empty>
          ) : (
            <div className="list">
              {campanas.map((c) => {
                const [texto, clase] = ESTADO[c.estado] ?? [c.estado, "b-neutral"];
                return (
                  <Link className="item" key={c.id} href={`/panel/campanas/${c.id}`}>
                    <div className="main">
                      <div>
                        <div className="title">{c.nombre}</div>
                        <div className="meta">
                          {TIPO_CAMPANA[c.tipo]} {c.anio} · {c.alumnos[0]?.count ?? 0} alumnos · toma {dia(c.fecha_captura)} · entrega {dia(c.fecha_entrega)}
                        </div>
                      </div>
                    </div>
                    <div className="end">
                      <span className={`badge ${clase}`}>{texto}</span>
                      <ChevronRight className="i chev" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2>Datos del colegio</h2></div>
          <div className="card-body">
            <dl className="info-list">
              <div><dt>Director(a)</dt><dd>{colegio.director ?? "—"}</dd></div>
              <div><dt>Contacto (comité / APAFA)</dt><dd>{colegio.contacto_nombre ?? "—"}</dd></div>
              <div><dt>Teléfono</dt><dd>{colegio.contacto_telefono ?? "—"}</dd></div>
              <div><dt>Dirección</dt><dd>{colegio.direccion ?? "—"}</dd></div>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
