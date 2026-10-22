import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Contact, Handshake, ListTodo, Plus, Target, Trophy, UserPlus } from "lucide-react";
import { PERMISOS, requirePerfil } from "@/lib/auth";
import { CARGO, ETAPA, S, TIPO_CAMPANA, dia, hoyLima, whatsapp } from "@/lib/formato";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Avatar, Empty, PageHeader, Tabs, WhatsApp } from "@/components/ui";
import { alternarTarea, crearContacto, crearOportunidad, crearTarea, moverOportunidad } from "../acciones-erp";

const COLUMNAS = ["nuevo", "contactado", "reunion", "propuesta", "ganado"] as const;

type Oportunidad = {
  id: string; titulo: string; colegio_nombre: string | null; contacto_nombre: string | null; telefono: string | null;
  tipo: string; etapa: string; alumnos_estimados: number | null; monto_estimado: number | null; proxima_accion: string | null;
  colegios: { nombre: string } | null;
};
type Tarea = {
  id: string; titulo: string; vence: string; hecha: boolean; colegio_id: string | null; oportunidad_id: string | null;
  colegios: { nombre: string } | null; oportunidades: { titulo: string } | null; perfiles: { nombre: string } | null;
};

export default async function Clientes({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; nuevo?: string; ok?: string; error?: string; perdidos?: string }>;
}) {
  const { vista = "embudo", nuevo, perdidos, ...aviso } = await searchParams;
  const { supabase } = await requirePerfil(PERMISOS.clientes);
  const hoy = hoyLima();

  const [{ data: ops }, { data: tareas }, { data: contactos }, { data: colegios }, { data: equipo }] = await Promise.all([
    supabase
      .from("oportunidades")
      .select("id, titulo, colegio_nombre, contacto_nombre, telefono, tipo, etapa, alumnos_estimados, monto_estimado, proxima_accion, colegios(nombre)")
      .order("proxima_accion", { ascending: true, nullsFirst: false })
      .returns<Oportunidad[]>(),
    supabase
      .from("tareas")
      .select("id, titulo, vence, hecha, colegio_id, oportunidad_id, colegios(nombre), oportunidades(titulo), perfiles!tareas_asignado_a_fkey(nombre)")
      .or(`hecha.eq.false,vence.gte.${hoy}`)
      .order("vence")
      .limit(200)
      .returns<Tarea[]>(),
    vista === "contactos"
      ? supabase.from("contactos").select("id, nombre, cargo, telefono, email, colegio_id, colegios(nombre)").order("nombre")
      : Promise.resolve({ data: [] }),
    supabase.from("colegios").select("id, nombre").order("nombre"),
    supabase.from("perfiles").select("id, nombre").order("nombre"),
  ]);

  const todas = ops ?? [];
  const abiertas = todas.filter((o) => !["ganado", "perdido"].includes(o.etapa));
  const enJuego = abiertas.reduce((s, o) => s + Number(o.monto_estimado ?? 0), 0);
  const ganadas = todas.filter((o) => o.etapa === "ganado").length;
  const pendientes = (tareas ?? []).filter((t) => !t.hecha);
  const paraHoy = pendientes.filter((t) => t.vence <= hoy).length;

  const formOportunidad = (
    <form action={crearOportunidad} className="form">
      <input type="hidden" name="volver" value="/panel/clientes" />
      <div className="fields">
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          ¿Qué quieres conseguir?
          <input name="titulo" placeholder="Promoción 2027 – I.E. Santa Rosa" />
        </label>
        <label className="field">
          Colegio que ya es cliente
          <select name="colegio_id" defaultValue="">
            <option value="">— Es un colegio nuevo —</option>
            {(colegios ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="field">Nombre del colegio nuevo<input name="colegio_nombre" placeholder="I.E. Santa Rosa" /></label>
        <label className="field">Persona de contacto<input name="contacto_nombre" placeholder="Prof. Ruiz (tutor 5.º)" /></label>
        <label className="field">Celular<input name="telefono" type="tel" placeholder="9xx xxx xxx" /></label>
        <label className="field">
          Tipo
          <select name="tipo" defaultValue="promocion">
            {Object.entries(TIPO_CAMPANA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className="field">Alumnos aprox.<input name="alumnos_estimados" type="number" min={0} /></label>
        <label className="field">Venta estimada (S/)<input name="monto_estimado" inputMode="decimal" /></label>
        <label className="field">Próximo paso para el día<input name="proxima_accion" type="date" /></label>
      </div>
      <label className="field">Notas<textarea name="notas" style={{ minHeight: 80, fontFamily: "inherit" }} /></label>
      <div className="form-foot"><button className="btn" type="submit">Agregar al embudo</button></div>
    </form>
  );

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Colegios por conseguir, contactos y recordatorios del día."
        actions={
          <>
            <Modal abrir={nuevo === "tarea"} variant="secondary" label="Recordatorio" title="Nuevo recordatorio" icon={<CalendarClock className="i" />}>
              <form action={crearTarea} className="form">
                <input type="hidden" name="volver" value="/panel/clientes?vista=tareas" />
                <div className="fields">
                  <label className="field" style={{ gridColumn: "1 / -1" }}>¿Qué hay que hacer?<input name="titulo" required placeholder="Llamar a la directora para fijar fecha" /></label>
                  <label className="field">Para el día<input name="vence" type="date" defaultValue={hoy} required /></label>
                  <label className="field">
                    Encargado
                    <select name="asignado_a" defaultValue="">
                      <option value="">Yo</option>
                      {(equipo ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    Colegio (opcional)
                    <select name="colegio_id" defaultValue="">
                      <option value="">—</option>
                      {(colegios ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </label>
                </div>
                <div className="form-foot"><button className="btn" type="submit">Guardar</button></div>
              </form>
            </Modal>
            <Modal abrir={nuevo === "oportunidad"} label="Nueva oportunidad" title="Nueva oportunidad" icon={<Plus className="i" />}>
              {formOportunidad}
            </Modal>
          </>
        }
      />
      <Aviso {...aviso} />

      <div className="kpis">
        <div className="kpi">
          <div className="top">Oportunidades abiertas <span className="ico"><Target className="i" /></span></div>
          <div className="val">{abiertas.length}</div>
          <div className="sub">en el embudo</div>
        </div>
        <div className="kpi">
          <div className="top">Venta en juego <span className="ico info"><Handshake className="i" /></span></div>
          <div className="val">{S(enJuego)}</div>
          <div className="sub">si se cierran todas</div>
        </div>
        <Link className={`kpi${paraHoy ? " alert" : ""}`} href="/panel/clientes?vista=tareas">
          <div className="top">Para hoy <span className={`ico ${paraHoy ? "bad" : ""}`}><ListTodo className="i" /></span></div>
          <div className="val">{paraHoy}</div>
          <div className="sub">recordatorios vencidos o de hoy</div>
        </Link>
        <div className="kpi">
          <div className="top">Ganadas <span className="ico warn"><Trophy className="i" /></span></div>
          <div className="val">{ganadas}</div>
          <div className="sub">colegios conseguidos</div>
        </div>
      </div>

      <Tabs
        items={[
          { href: "/panel/clientes", label: "Embudo de ventas", count: abiertas.length, active: vista === "embudo" },
          { href: "/panel/clientes?vista=tareas", label: "Recordatorios", count: pendientes.length, active: vista === "tareas" },
          { href: "/panel/clientes?vista=contactos", label: "Contactos", active: vista === "contactos" },
        ]}
      />

      {vista === "embudo" && (
        <>
          <div className="board">
            {COLUMNAS.map((etapa, i) => {
              const items = todas.filter((o) => o.etapa === etapa);
              const total = items.reduce((s, o) => s + Number(o.monto_estimado ?? 0), 0);
              return (
                <section className="column" key={etapa} data-etapa={etapa}>
                  <header>
                    <span className={`badge ${ETAPA[etapa][1]}`}>{ETAPA[etapa][0]}</span>
                    <span className="col-count">{items.length}</span>
                    {total > 0 && <span className="col-sum">{S(total)}</span>}
                  </header>
                  {items.length === 0 && <p className="col-empty">Nada aquí</p>}
                  {items.map((o) => {
                    const vencida = o.proxima_accion && o.proxima_accion < hoy && etapa !== "ganado";
                    return (
                      <article className="deal" key={o.id}>
                        <Link href={`/panel/clientes/${o.id}`} className="deal-main">
                          <b>{o.titulo}</b>
                          <small>{o.colegios?.nombre ?? o.colegio_nombre ?? "Colegio por definir"} · {TIPO_CAMPANA[o.tipo]}</small>
                          <span className="deal-meta">
                            {o.monto_estimado ? <span className="money">{S(o.monto_estimado)}</span> : null}
                            {o.alumnos_estimados ? <span>{o.alumnos_estimados} alumnos</span> : null}
                            {o.proxima_accion && (
                              <span className={vencida ? "late" : ""}><CalendarClock className="i" /> {dia(o.proxima_accion)}</span>
                            )}
                          </span>
                        </Link>
                        <footer>
                          {i > 0 ? (
                            <form action={moverOportunidad}>
                              <input type="hidden" name="id" value={o.id} />
                              <input type="hidden" name="etapa" value={COLUMNAS[i - 1]} />
                              <button className="icon-btn" title={`Regresar a ${ETAPA[COLUMNAS[i - 1]][0]}`} aria-label="Etapa anterior"><ChevronLeft className="i" /></button>
                            </form>
                          ) : <span />}
                          <WhatsApp href={whatsapp(o.telefono, `Hola ${o.contacto_nombre ?? ""}, le saluda Fotos Jeff.`)} label="" />
                          {i < COLUMNAS.length - 1 ? (
                            <form action={moverOportunidad}>
                              <input type="hidden" name="id" value={o.id} />
                              <input type="hidden" name="etapa" value={COLUMNAS[i + 1]} />
                              <button className="btn sm secondary" title={`Pasar a ${ETAPA[COLUMNAS[i + 1]][0]}`}>
                                {ETAPA[COLUMNAS[i + 1]][0]} <ChevronRight className="i" />
                              </button>
                            </form>
                          ) : <span />}
                        </footer>
                      </article>
                    );
                  })}
                </section>
              );
            })}
          </div>
          {todas.some((o) => o.etapa === "perdido") && (
            <p className="muted-text">
              {perdidos ? (
                <Link href="/panel/clientes">Ocultar perdidas</Link>
              ) : (
                <Link href="/panel/clientes?perdidos=1">Ver {todas.filter((o) => o.etapa === "perdido").length} oportunidades perdidas</Link>
              )}
            </p>
          )}
          {perdidos && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="list">
                {todas.filter((o) => o.etapa === "perdido").map((o) => (
                  <Link className="item" key={o.id} href={`/panel/clientes/${o.id}`}>
                    <div className="main"><div><div className="title">{o.titulo}</div><div className="meta">{o.colegio_nombre ?? o.colegios?.nombre}</div></div></div>
                    <div className="end"><span className="badge b-bad">Perdido</span><ChevronRight className="i chev" /></div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {vista === "tareas" && (
        <div className="card">
          {(tareas ?? []).length === 0 ? (
            <Empty icon={ListTodo} title="Sin recordatorios">Crea uno con el botón “Recordatorio”.</Empty>
          ) : (
            [
              ["Vencidos", (t: Tarea) => !t.hecha && t.vence < hoy],
              ["Hoy", (t: Tarea) => !t.hecha && t.vence === hoy],
              ["Próximos", (t: Tarea) => !t.hecha && t.vence > hoy],
              ["Hechos", (t: Tarea) => t.hecha],
            ].map(([titulo, filtro]) => {
              const grupo = (tareas ?? []).filter(filtro as (t: Tarea) => boolean);
              if (grupo.length === 0) return null;
              return (
                <div key={titulo as string}>
                  <div className="group-head">{titulo as string} <span>{grupo.length}</span></div>
                  <div className="list">
                    {grupo.map((t) => (
                      <div className={`item task${t.hecha ? " done" : ""}`} key={t.id}>
                        <form action={alternarTarea}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="hecha" value={t.hecha ? "0" : "1"} />
                          <input type="hidden" name="volver" value="/panel/clientes?vista=tareas" />
                          <button className="check-btn" aria-label={t.hecha ? "Marcar como pendiente" : "Marcar como hecho"} />
                        </form>
                        <div className="main">
                          <div>
                            <div className="title">{t.titulo}</div>
                            <div className="meta">
                              {[t.colegios?.nombre, t.oportunidades?.titulo, t.perfiles?.nombre && `Encargado: ${t.perfiles.nombre}`].filter(Boolean).join(" · ") || "Sin colegio"}
                            </div>
                          </div>
                        </div>
                        <div className="end">
                          <span className={`badge ${t.hecha ? "b-neutral" : t.vence < hoy ? "b-bad" : t.vence === hoy ? "b-warn" : "b-info"}`}>
                            {t.vence === hoy ? "Hoy" : dia(t.vence)}
                          </span>
                          {t.oportunidad_id && <Link className="btn ghost sm" href={`/panel/clientes/${t.oportunidad_id}`}>Abrir</Link>}
                          {!t.oportunidad_id && t.colegio_id && <Link className="btn ghost sm" href={`/panel/colegios/${t.colegio_id}`}>Abrir</Link>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {vista === "contactos" && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Contactos</h2>
              <p>Directores, comités y padres con quienes coordinas.</p>
            </div>
            <Modal label="Nuevo contacto" title="Nuevo contacto" icon={<UserPlus className="i" />} variant="secondary">
              <form action={crearContacto} className="form">
                <input type="hidden" name="volver" value="/panel/clientes?vista=contactos" />
                <div className="fields">
                  <label className="field">Nombre<input name="nombre" required /></label>
                  <label className="field">
                    Cargo
                    <select name="cargo" defaultValue="director">
                      {Object.entries(CARGO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    Colegio
                    <select name="colegio_id" defaultValue="">
                      <option value="">—</option>
                      {(colegios ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
            <Empty icon={Contact} title="Aún no hay contactos">Agrega al director o al comité de cada colegio.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nombre</th><th>Colegio</th><th>Celular</th><th></th></tr></thead>
                <tbody>
                  {(contactos as { id: string; nombre: string; cargo: string; telefono: string | null; email: string | null; colegio_id: string | null; colegios: { nombre: string } | null }[]).map((c) => (
                    <tr key={c.id}>
                      <td><div className="person"><Avatar name={c.nombre} /><div><b>{c.nombre}</b><small>{CARGO[c.cargo]}{c.email && ` · ${c.email}`}</small></div></div></td>
                      <td>{c.colegio_id ? <Link href={`/panel/colegios/${c.colegio_id}`}>{c.colegios?.nombre}</Link> : "—"}</td>
                      <td>{c.telefono ?? "—"}</td>
                      <td className="num"><WhatsApp href={whatsapp(c.telefono, `Hola ${c.nombre.split(" ")[0]}, le saluda Fotos Jeff.`)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
