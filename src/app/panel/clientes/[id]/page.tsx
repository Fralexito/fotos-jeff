import Link from "next/link";
import { notFound } from "next/navigation";
import { School } from "lucide-react";
import { PERMISOS, requirePerfil } from "@/lib/auth";
import { ETAPA, S, TIPO_CAMPANA, dia, hoyLima, whatsapp } from "@/lib/formato";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { PageHeader, WhatsApp } from "@/components/ui";
import { Historial, FormActividad } from "@/components/historial";
import { actualizarOportunidad, convertirEnColegio, crearTarea } from "../../acciones-erp";

export default async function OportunidadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [{ id }, aviso] = await Promise.all([params, searchParams]);
  const { supabase } = await requirePerfil(PERMISOS.clientes);
  const [{ data: o }, { data: actividades }, { data: tareas }] = await Promise.all([
    supabase.from("oportunidades").select("*, colegios(id, nombre), perfiles(nombre)").eq("id", id).single(),
    supabase.from("actividades").select("id, tipo, detalle, creado_en, perfiles(nombre)").eq("oportunidad_id", id).order("creado_en", { ascending: false }),
    supabase.from("tareas").select("id, titulo, vence, hecha").eq("oportunidad_id", id).order("vence"),
  ]);
  if (!o) notFound();
  const volver = `/panel/clientes/${id}`;
  const [etapaTxt, etapaClase] = ETAPA[o.etapa];

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/panel/clientes", label: "Clientes" }]}
        title={o.titulo}
        subtitle={<><span className={`badge ${etapaClase}`}>{etapaTxt}</span> · {TIPO_CAMPANA[o.tipo]}{o.monto_estimado ? ` · ${S(o.monto_estimado)} estimado` : ""}</>}
        actions={
          <>
            <WhatsApp sm={false} href={whatsapp(o.telefono, `Hola ${o.contacto_nombre ?? ""}, le saluda Fotos Jeff.`)} />
            {o.colegios ? (
              <Link className="btn secondary" href={`/panel/colegios/${o.colegios.id}`}><School className="i" /> Ver colegio</Link>
            ) : (
              <Modal label="Convertir en colegio" title="Registrar como colegio cliente" icon={<School className="i" />}>
                <form action={convertirEnColegio} className="form">
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="volver" value={volver} />
                  <p className="muted-text" style={{ margin: 0 }}>Se crea “{o.colegio_nombre || o.titulo}” en Colegios y la oportunidad queda como ganada.</p>
                  <div className="fields">
                    <label className="field">Código corto<input name="codigo" required maxLength={12} placeholder="SRO" /></label>
                    <label className="field">Ciudad<input name="ciudad" defaultValue="Nauta" /></label>
                  </div>
                  <div className="form-foot"><button className="btn" type="submit">Crear colegio</button></div>
                </form>
              </Modal>
            )}
          </>
        }
      />
      <Aviso {...aviso} />

      <div className="grid-2">
        <div>
          <div className="card">
            <div className="card-head"><div><h2>Historial</h2><p>Llamadas, visitas y mensajes con este cliente.</p></div></div>
            <div className="card-body"><FormActividad oportunidadId={o.id} colegioId={o.colegio_id} volver={volver} /></div>
            <Historial items={actividades ?? []} />
          </div>
        </div>
        <div>
          <div className="card">
            <div className="card-head"><h2>Datos</h2></div>
            <form action={actualizarOportunidad} className="card-body form">
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="volver" value={volver} />
              <label className="field">Título<input name="titulo" defaultValue={o.titulo} required /></label>
              <label className="field">
                Etapa
                <select name="etapa" defaultValue={o.etapa}>
                  {Object.entries(ETAPA).map(([v, [t]]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </label>
              {!o.colegios && <label className="field">Colegio<input name="colegio_nombre" defaultValue={o.colegio_nombre ?? ""} /></label>}
              <label className="field">Contacto<input name="contacto_nombre" defaultValue={o.contacto_nombre ?? ""} /></label>
              <label className="field">Celular<input name="telefono" type="tel" defaultValue={o.telefono ?? ""} /></label>
              <label className="field">
                Tipo
                <select name="tipo" defaultValue={o.tipo}>
                  {Object.entries(TIPO_CAMPANA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </label>
              <div className="fields">
                <label className="field">Alumnos<input name="alumnos_estimados" type="number" min={0} defaultValue={o.alumnos_estimados ?? ""} /></label>
                <label className="field">Venta (S/)<input name="monto_estimado" inputMode="decimal" defaultValue={o.monto_estimado ?? ""} /></label>
              </div>
              <label className="field">Próximo paso<input name="proxima_accion" type="date" defaultValue={o.proxima_accion ?? ""} /></label>
              <label className="field">Notas<textarea name="notas" defaultValue={o.notas ?? ""} style={{ minHeight: 80, fontFamily: "inherit" }} /></label>
              <div className="form-foot"><button className="btn" type="submit">Guardar</button></div>
            </form>
          </div>
          <div className="card">
            <div className="card-head"><h2>Recordatorios</h2></div>
            <div className="list">
              {(tareas ?? []).map((t) => (
                <div className={`item${t.hecha ? " done" : ""}`} key={t.id}>
                  <div className="main"><div className="title">{t.titulo}</div></div>
                  <div className="end"><span className={`badge ${t.hecha ? "b-neutral" : t.vence < hoyLima() ? "b-bad" : "b-info"}`}>{dia(t.vence)}</span></div>
                </div>
              ))}
            </div>
            <form action={crearTarea} className="card-body inline-form">
              <input type="hidden" name="oportunidad_id" value={o.id} />
              {o.colegio_id && <input type="hidden" name="colegio_id" value={o.colegio_id} />}
              <input type="hidden" name="volver" value={volver} />
              <input className="input" name="titulo" placeholder="Nuevo recordatorio" required />
              <input className="input" name="vence" type="date" defaultValue={hoyLima()} style={{ width: 150 }} />
              <button className="btn secondary" type="submit">Agregar</button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
