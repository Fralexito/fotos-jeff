import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, ChevronRight, FolderOpen, UserPlus } from "lucide-react";
import { requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Empty, PageHeader } from "@/components/ui";
import { CARGO, TIPO_CAMPANA, fecha, whatsapp } from "@/lib/formato";
import { Avatar, WhatsApp } from "@/components/ui";
import { FormActividad, Historial } from "@/components/historial";
import { crearContacto } from "../../acciones-erp";
import { cambiarSedeColegio, crearCampana } from "../../actions";
import { NOMBRE_SEDE, NOMBRE_ZONA, SEDES, ZONAS } from "@/lib/sedes";

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
  const [{ data: contactos }, { data: actividades }] = await Promise.all([
    supabase.from("contactos").select("id, nombre, cargo, telefono").eq("colegio_id", id).order("nombre"),
    supabase.from("actividades").select("id, tipo, detalle, creado_en, perfiles(nombre)").eq("colegio_id", id).order("creado_en", { ascending: false }).limit(30),
  ]);
  const volver = `/panel/colegios/${id}`;

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
        subtitle={`Sede ${NOMBRE_SEDE[colegio.sede] ?? colegio.sede} · ${colegio.ciudad}${colegio.zona !== "ciudad" ? ` (${NOMBRE_ZONA[colegio.zona]?.toLowerCase()})` : ""} · código ${colegio.codigo}`}
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
            <form action={cambiarSedeColegio} className="form sede-form">
              <input type="hidden" name="id" value={colegio.id} />
              <div className="fields">
                <label className="field">
                  Sede
                  <select name="sede" defaultValue={colegio.sede}>
                    {SEDES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
                <label className="field">
                  Dónde queda
                  <select name="zona" defaultValue={colegio.zona}>
                    {ZONAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
                <label className="field">Ciudad o pueblo<input name="ciudad" defaultValue={colegio.ciudad} /></label>
              </div>
              <div className="form-foot"><button className="btn secondary sm" type="submit">Guardar ubicación</button></div>
            </form>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div><h2>Historial</h2><p>Llamadas, visitas y acuerdos con el colegio.</p></div></div>
          <div className="card-body"><FormActividad colegioId={colegio.id} volver={volver} /></div>
          <Historial items={actividades ?? []} />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Contactos</h2>
            <Modal label="Agregar" title="Nuevo contacto" icon={<UserPlus className="i" />} variant="secondary">
              <form action={crearContacto} className="form">
                <input type="hidden" name="colegio_id" value={colegio.id} />
                <input type="hidden" name="volver" value={volver} />
                <div className="fields">
                  <label className="field">Nombre<input name="nombre" required /></label>
                  <label className="field">
                    Cargo
                    <select name="cargo" defaultValue="director">
                      {Object.entries(CARGO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                  </label>
                  <label className="field">Celular<input name="telefono" type="tel" /></label>
                  <label className="field">Correo<input name="email" type="email" /></label>
                </div>
                <div className="form-foot"><button className="btn" type="submit">Guardar contacto</button></div>
              </form>
            </Modal>
          </div>
          {(contactos ?? []).length === 0 ? (
            <p className="muted-text" style={{ padding: "0 20px 20px" }}>Agrega al director, tutores o comité.</p>
          ) : (
            <div className="list">
              {(contactos ?? []).map((c) => (
                <div className="item" key={c.id}>
                  <div className="main">
                    <Avatar name={c.nombre} />
                    <div><div className="title">{c.nombre}</div><div className="meta">{CARGO[c.cargo]}{c.telefono && ` · ${c.telefono}`}</div></div>
                  </div>
                  <div className="end"><WhatsApp href={whatsapp(c.telefono, `Hola ${c.nombre.split(" ")[0]}, le saluda Fotos Jefferson.`)} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
