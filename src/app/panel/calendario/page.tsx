import Link from "next/link";
import { Camera, CalendarPlus, ChevronLeft, ChevronRight, ListTodo, Truck } from "lucide-react";
import { puede, requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/ui";
import { dia, hoyLima } from "@/lib/formato";
import { filtroSede } from "@/lib/sedes";
import { programarCampana } from "../actions";
import { SimpleLista, SimpleTitulo } from "@/components/simple";

type Campana = { id: string; nombre: string; estado: string; fecha_captura: string | null; fecha_entrega: string | null; colegios: { nombre: string } | null };
type Evento = { fecha: string; tipo: "toma" | "entrega" | "tarea"; titulo: string; detalle: string; href: string };

const ICONO = { toma: Camera, entrega: Truck, tarea: ListTodo };
const TIPO = { toma: "Toma de fotos", entrega: "Entrega", tarea: "Recordatorio" };
const SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

// Calendario del mes con las tomas, entregas y recordatorios; debajo, la agenda de los próximos días.
export default async function Calendario({ searchParams }: { searchParams: Promise<{ mes?: string; ok?: string; error?: string }> }) {
  const { mes: pedido, ...aviso } = await searchParams;
  const { supabase, perfil } = await requirePerfil();
  const sede = filtroSede(perfil.preferencias.sede);
  const hoy = hoyLima();
  const mes = /^\d{4}-\d{2}$/.test(pedido ?? "") ? pedido! : hoy.slice(0, 7);

  const primero = new Date(mes + "-01T12:00:00Z");
  const dias = new Date(Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth() + 1, 0)).getUTCDate();
  const ini = `${mes}-01`;
  const fin = `${mes}-${String(dias).padStart(2, "0")}`;
  const mover = (n: number) => iso(new Date(Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth() + n, 1, 12))).slice(0, 7);
  // La agenda mira 14 días desde hoy, aunque caigan en otro mes.
  const hasta14 = iso(new Date(new Date(hoy + "T12:00:00Z").getTime() + 13 * 86400000));
  const desde = ini < hoy ? ini : hoy;
  const hasta = fin > hasta14 ? fin : hasta14;

  let qCampanas = supabase
    .from("campanas")
    .select(sede ? "id, nombre, estado, fecha_captura, fecha_entrega, colegios!inner(nombre, sede)" : "id, nombre, estado, fecha_captura, fecha_entrega, colegios(nombre)")
    .neq("estado", "cerrada")
    .order("creado_en", { ascending: false });
  if (sede) qCampanas = qCampanas.eq("colegios.sede", sede);
  const [{ data: campanasData }, tareas] = await Promise.all([
    qCampanas.returns<Campana[]>(),
    puede(perfil, "clientes")
      ? supabase.from("tareas").select("id, titulo, vence, colegios(nombre)").eq("hecha", false).gte("vence", desde).lte("vence", hasta)
          .returns<{ id: string; titulo: string; vence: string; colegios: { nombre: string } | null }[]>()
      : { data: [] },
  ]);
  const campanas = campanasData ?? [];

  const eventos: Evento[] = [
    ...campanas.flatMap((c) => [
      ...(c.fecha_captura ? [{ fecha: c.fecha_captura, tipo: "toma" as const, titulo: c.colegios?.nombre ?? "", detalle: c.nombre, href: `/panel/campanas/${c.id}` }] : []),
      ...(c.fecha_entrega ? [{ fecha: c.fecha_entrega, tipo: "entrega" as const, titulo: c.colegios?.nombre ?? "", detalle: c.nombre, href: `/panel/campanas/${c.id}` }] : []),
    ]),
    ...(tareas.data ?? []).map((t) => ({ fecha: t.vence, tipo: "tarea" as const, titulo: t.titulo, detalle: t.colegios?.nombre ?? "", href: "/panel/clientes?vista=tareas" })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo));
  const porDia = new Map<string, Evento[]>();
  for (const e of eventos) porDia.set(e.fecha, [...(porDia.get(e.fecha) ?? []), e]);

  const hueco = (primero.getUTCDay() + 6) % 7;
  const celdas = [...Array(hueco).fill(null), ...Array.from({ length: dias }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)];
  while (celdas.length % 7) celdas.push(null);
  const agenda = eventos.filter((e) => e.fecha >= hoy && e.fecha <= hasta14);
  const sinFecha = campanas.filter((c) => !c.fecha_captura || !c.fecha_entrega);
  const titulo = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(primero);
  const manana = iso(new Date(new Date(hoy + "T12:00:00Z").getTime() + 86400000));
  const nombreDia = (f: string) =>
    f === hoy ? "Hoy" : f === manana ? "Mañana" : new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(f + "T12:00:00Z"));

  // Vista sencilla: sin cuadrícula del mes, solo lo que viene día por día.
  if (perfil.preferencias.vista === "sencilla") {
    const fechas = [...new Set(agenda.map((e) => e.fecha))];
    const PALABRA = { toma: "Tomar fotos", entrega: "Entregar fotos", tarea: "Recordar" };
    return (
      <div className="simple">
        <SimpleTitulo titulo="Lo que viene" sub="Las próximas dos semanas" />
        {fechas.length === 0 && <p className="simple-vacio">No hay nada programado.</p>}
        {fechas.map((f) => (
          <div key={f} className="simple-dia">
            <h2 className="simple-sub">{nombreDia(f).charAt(0).toUpperCase() + nombreDia(f).slice(1)}</h2>
            <SimpleLista
              vacio=""
              filas={agenda.filter((e) => e.fecha === f).map((e, i) => ({
                key: `${f}-${i}`, href: e.href, titulo: e.titulo, sub: `${PALABRA[e.tipo]}${e.detalle ? ` · ${e.detalle}` : ""}`,
              }))}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        modulo="calendario"
        title="Calendario"
        subtitle="Tomas de fotos, entregas y recordatorios de todos los colegios."
        actions={
          campanas.length > 0 && (
            <Modal label="Programar fechas" title="Programar una campaña" icon={<CalendarPlus className="i" />}>
              <form action={programarCampana} className="form">
                <input type="hidden" name="mes" value={mes} />
                <label className="field">
                  Campaña
                  <select className="input" name="campana_id" required>
                    {campanas.map((c) => <option key={c.id} value={c.id}>{c.colegios?.nombre} · {c.nombre}</option>)}
                  </select>
                </label>
                <div className="fields">
                  <label className="field">Día de la toma<input className="input" type="date" name="fecha_captura" /></label>
                  <label className="field">Día de entrega<input className="input" type="date" name="fecha_entrega" /></label>
                </div>
                <p className="muted-text">Puedes llenar solo una; la otra se queda como estaba.</p>
                <div className="form-foot"><button className="btn" type="submit">Guardar fechas</button></div>
              </form>
            </Modal>
          )
        }
      />
      <Aviso {...aviso} />

      <div className="cal-leyenda">
        {(["toma", "entrega", "tarea"] as const).map((t) => {
          const I = ICONO[t];
          return <span key={t} className={`cal-ev ${t}`}><I className="i" /> {TIPO[t]}</span>;
        })}
      </div>

      <section className="card cal">
        <div className="card-head cal-cab">
          <h2>{titulo.charAt(0).toUpperCase() + titulo.slice(1)}</h2>
          <div className="daynav">
            <Link className="icon-btn" href={`/panel/calendario?mes=${mover(-1)}`} aria-label="Mes anterior"><ChevronLeft className="i" /></Link>
            {mes !== hoy.slice(0, 7) && <Link className="btn ghost sm" href="/panel/calendario">Hoy</Link>}
            <Link className="icon-btn" href={`/panel/calendario?mes=${mover(1)}`} aria-label="Mes siguiente"><ChevronRight className="i" /></Link>
          </div>
        </div>
        <div className="cal-grid" role="grid">
          {SEMANA.map((d) => <div key={d} className="cal-sem" role="columnheader">{d}</div>)}
          {celdas.map((f, i) => {
            if (!f) return <div key={`v${i}`} className="cal-dia vacio" />;
            const evs = porDia.get(f) ?? [];
            return (
              <div key={f} className={`cal-dia${f === hoy ? " hoy" : ""}${f < hoy ? " pasado" : ""}`} role="gridcell">
                <span className="cal-num">{Number(f.slice(8))}</span>
                {evs.slice(0, 3).map((e, j) => {
                  const I = ICONO[e.tipo];
                  return (
                    <Link key={j} href={e.href} className={`cal-ev ${e.tipo}`} title={`${TIPO[e.tipo]}: ${e.titulo} · ${e.detalle}`}>
                      <I className="i" /><span>{e.titulo}</span>
                    </Link>
                  );
                })}
                {evs.length > 3 && <span className="cal-mas">+{evs.length - 3} más</span>}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2>Próximos 14 días</h2></div>
          {agenda.length === 0 ? (
            <p className="muted-text arbol-vacio">No hay nada programado. Usa “Programar fechas”.</p>
          ) : (
            <ol className="timeline cal-agenda">
              {agenda.map((e, i) => {
                const I = ICONO[e.tipo];
                const nuevoDia = i === 0 || agenda[i - 1].fecha !== e.fecha;
                return (
                  <li key={i}>
                    <span className={`tl-ico cal-${e.tipo}`}><I /></span>
                    <div>
                      {nuevoDia && <small className="cal-fecha">{nombreDia(e.fecha)}</small>}
                      <p><Link href={e.href}><b>{e.titulo}</b></Link></p>
                      <small>{TIPO[e.tipo]}{e.detalle && ` · ${e.detalle}`}</small>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <section className="card">
          <div className="card-head"><h2>Sin fecha</h2><p>Campañas abiertas a las que les falta el día de toma o de entrega.</p></div>
          {sinFecha.length === 0 ? (
            <p className="muted-text arbol-vacio">Todas tienen fecha.</p>
          ) : (
            <ul className="list">
              {sinFecha.map((c) => (
                <li key={c.id}>
                  <Link className="item" href={`/panel/campanas/${c.id}`}>
                    <div className="main">
                      <div>
                        <div className="title">{c.colegios?.nombre}</div>
                        <div className="meta">{c.nombre} · toma {c.fecha_captura ? dia(c.fecha_captura) : "sin fecha"} · entrega {c.fecha_entrega ? dia(c.fecha_entrega) : "sin fecha"}</div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
