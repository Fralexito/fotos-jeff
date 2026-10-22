import { SEDES, filtroSede } from "@/lib/sedes";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Search, Truck, Boxes, CalendarDays, Camera, ChevronRight, CircleAlert, CircleCheck, Factory, HandCoins, Handshake, ListTodo, PackageCheck, Sparkles, Sun, Target, Wallet } from "lucide-react";
import { requirePerfil, puede } from "@/lib/auth";
import { S, TIPO_CAMPANA, fecha, saludo } from "@/lib/formato";
import { Avatar, Empty } from "@/components/ui";
import { Contador } from "@/components/contador";
import { Barras, Dona } from "@/components/graficos";
import { Modal } from "@/components/modal";
import { Aviso } from "@/components/aviso";
import { tablero } from "@/lib/tablero";
import { guardarMeta } from "./actions";

const RANGOS = [7, 30, 60];

export default async function Inicio({ searchParams }: { searchParams: Promise<{ dias?: string; ok?: string; error?: string }> }) {
  const { dias: d, ...aviso } = await searchParams;
  const rango = RANGOS.includes(Number(d)) ? Number(d) : 7;
  const { supabase, perfil } = await requirePerfil();
  const veDinero = puede(perfil, "cobros");

  // Últimos 7 días (hoy incluido) en hora de Lima, para el total de hoy y el mini gráfico.
  const diaLima = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d);
  const dias = Array.from({ length: 7 }, (_, i) => diaLima(new Date(Date.now() - (6 - i) * 86400000)));
  const desde = `${dias[0]}T00:00:00-05:00`;

  // Si arriba se eligió una sede, el resumen es solo de esa sede.
  const sede = filtroSede(perfil.preferencias.sede);
  let qSemana = supabase.from("pagos").select(sede ? "monto, creado_en, pedidos!inner(sede)" : "monto, creado_en").eq("estado", "confirmado").gte("creado_en", desde);
  let qSaldos = supabase.from("pedidos_saldo").select("saldo").neq("estado", "anulado").gt("saldo", 0);
  let qListos = supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("estado", "en_impresion");
  let qProximas = supabase
    .from("campanas")
    .select(sede ? "id, nombre, tipo, fecha_captura, colegios!inner(nombre, sede), alumnos(count)" : "id, nombre, tipo, fecha_captura, colegios(nombre), alumnos(count)")
    .neq("estado", "cerrada")
    .order("fecha_captura", { ascending: true, nullsFirst: false })
    .limit(5);
  if (sede) {
    qSemana = qSemana.eq("pedidos.sede", sede);
    qSaldos = qSaldos.eq("sede", sede);
    qListos = qListos.eq("sede", sede);
    qProximas = qProximas.eq("colegios.sede", sede);
  }

  const [semana, saldos, listos, porVerificar, proximas, tareas, materiales] = await Promise.all([
    veDinero ? qSemana.returns<{ monto: number; creado_en: string }[]>() : null,
    veDinero ? qSaldos : null,
    qListos,
    veDinero
      ? supabase.from("pagos").select("id", { count: "exact", head: true }).eq("estado", "por_verificar")
      : null,
    qProximas.returns<{ id: string; nombre: string; tipo: string; fecha_captura: string | null; colegios: { nombre: string } | null; alumnos: { count: number }[] }[]>(),
    supabase
      .from("tareas")
      .select("id, titulo, vence, colegios(nombre), oportunidad_id, colegio_id")
      .eq("hecha", false)
      .lte("vence", dias[6])
      .order("vence")
      .limit(6),
    supabase.from("materiales").select("id, nombre, stock, minimo, unidad").eq("activo", true),
  ]);
  const bajos = (materiales.data ?? []).filter((m) => Number(m.stock) <= Number(m.minimo));

  const porDia = dias.map((d) =>
    (semana?.data ?? []).filter((p) => diaLima(new Date(p.creado_en)) === d).reduce((s, p) => s + Number(p.monto), 0),
  );
  const cobradoHoy = porDia[6];
  const porCobrar = (saldos?.data ?? []).reduce((s, p) => s + Number(p.saldo), 0);
  const conSaldo = saldos?.data?.length ?? 0;
  const nVerificar = porVerificar?.count ?? 0;
  const dia = new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Lima" }).format(new Date());
  const hoyTexto = dia.charAt(0).toUpperCase() + dia.slice(1);

  // Vista sencilla: pensada para el abuelo. Dos números grandes y tres botones, nada más.
  if (perfil.preferencias.vista === "sencilla") {
    return (
      <div className="simple">
        <header className="simple-hola">
          <h1>{saludo()}, {perfil.nombre.split(" ")[0]}</h1>
          <p>{hoyTexto}</p>
        </header>

        {nVerificar > 0 && (
          <Link className="simple-aviso" href="/panel/cobros#verificar">
            <CircleAlert />
            <span>{nVerificar === 1 ? "Llegó 1 Yape o Plin. Revísalo." : `Llegaron ${nVerificar} Yape o Plin. Revísalos.`}</span>
            <ChevronRight />
          </Link>
        )}

        <div className="simple-numeros">
          {veDinero ? (
            <>
              <Link href="/panel/caja">
                <small>Hoy entró</small>
                <b><Contador valor={cobradoHoy} soles /></b>
              </Link>
              <Link href="/panel/reportes#deudores">
                <small>Falta cobrar</small>
                <b className="debe"><Contador valor={porCobrar} soles /></b>
              </Link>
            </>
          ) : (
            <Link href="/panel/produccion?vista=entregas">
              <small>Listos para entregar</small>
              <b><Contador valor={listos.count ?? 0} /></b>
            </Link>
          )}
        </div>

        <nav className="simple-botones" aria-label="Qué quieres hacer">
          {veDinero && (
            <Link className="principal" href="/panel/cobros"><HandCoins /> Cobrar un pago</Link>
          )}
          <Link href="/panel/buscar"><Search /> Buscar un alumno</Link>
          <Link href="/panel/produccion?vista=entregas"><Truck /> Entregar fotos</Link>
        </nav>
      </div>
    );
  }

  // Vista completa: tablero con meta del mes, caja, cuatro tarjetas y gráficos.
  const t = await tablero(supabase, sede, rango);
  const esDueno = perfil.rol === "dueno";
  const metasSede = esDueno ? (await supabase.from("metas").select("sede, monto").eq("mes", `${t.mes}-01`)).data ?? [] : [];
  const avance = t.meta > 0 ? Math.min(t.ingresosMes / t.meta, 1) : 0;
  const nombreMes = new Intl.DateTimeFormat("es-PE", { month: "long", timeZone: "UTC" }).format(new Date(`${t.mes}-15T12:00:00Z`));
  const etiquetaDia = (dia: string) =>
    dia === t.hoy ? "Hoy" : rango === 7
      ? new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: "UTC" }).format(new Date(dia + "T12:00:00Z"))
      : `${Number(dia.slice(8))}/${Number(dia.slice(5, 7))}`;
  const totalRango = t.serie.reduce((s, x) => s + x.monto, 0);
  const totalDemanda = t.demanda.reduce((s, x) => s + x.n, 0);

  return (
    <>
      <Aviso {...aviso} />
      {veDinero && nVerificar > 0 && (
        <Link className="banner" href="/panel/cobros#verificar">
          <CircleAlert className="i" />
          <span><b>{nVerificar === 1 ? "Hay 1 pago de Yape o Plin" : `Hay ${nVerificar} pagos de Yape o Plin`} por confirmar.</b> Revisa el celular del negocio.</span>
          <span className="banner-go">Revisar <ChevronRight className="i" /></span>
        </Link>
      )}

      <div className="tab-top">
        <section className="hero tab-hero">
          <div className="hero-main">
            <p className="hero-date">{hoyTexto}</p>
            <h1>{saludo()}, {perfil.nombre.split(" ")[0]}</h1>
            <p className="hero-sub">
              {t.tomasHoy > 0 ? <>Hoy tienes <b>{t.tomasHoy} {t.tomasHoy === 1 ? "toma programada" : "tomas programadas"}</b></> : "Hoy no hay tomas programadas"}
              {" · "}{t.sesiones} {t.sesiones === 1 ? "campaña en proceso" : "campañas en proceso"}
            </p>
            <div className="hero-actions">
              {veDinero && (
                <Link className="btn light" href="/panel/cobros">
                  <HandCoins className="i" /> Registrar un pago
                </Link>
              )}
              <Link className="btn glass" href="/panel/hoy">
                <Sun className="i" /> Resumen del día
              </Link>
              <Link className="btn glass" href="/panel/calendario">
                <CalendarDays className="i" /> Calendario
              </Link>
            </div>
          </div>
          {veDinero && (
            <div className="meta-box">
              <div className="meta-anillo" style={{ "--p": avance } as React.CSSProperties} role="img" aria-label={`Meta del mes al ${Math.round(avance * 100)}%`}>
                <svg viewBox="0 0 100 100" aria-hidden>
                  <circle cx="50" cy="50" r="42" className="meta-fondo" />
                  <circle cx="50" cy="50" r="42" className="meta-arco" pathLength={100} strokeDasharray={`${avance * 100} 100`} transform="rotate(-90 50 50)" />
                </svg>
                <span><b>{t.meta > 0 ? `${Math.round(avance * 100)}%` : "—"}</b><small>de la meta</small></span>
              </div>
              <div className="meta-txt">
                <div className="hero-label">Meta de {nombreMes}</div>
                <div className="meta-val">{t.meta > 0 ? S(t.meta) : "Sin meta"}</div>
                <div className="hero-sub">
                  {t.meta === 0 ? "Fija una meta para ver el avance" : t.ingresosMes >= t.meta ? "¡Meta cumplida!" : `Faltan ${S(t.meta - t.ingresosMes)}`}
                </div>
                {esDueno && (
                  <Modal variant="secondary" label={t.meta > 0 ? "Cambiar meta" : "Fijar meta"} title={`Meta de ventas de ${nombreMes}`} icon={<Target className="i" />}>
                    <form action={guardarMeta} className="form">
                      <input type="hidden" name="mes" value={t.mes} />
                      <p className="muted-text">Cuánto quieres cobrar este mes en cada sede. El tablero suma las sedes.</p>
                      {SEDES.map(([id, nombre]) => (
                        <label key={id} className="field">
                          <span>{nombre}</span>
                          <input name={`meta_${id}`} type="number" min="0" step="10" inputMode="decimal" placeholder="0"
                            defaultValue={Number(metasSede.find((m) => m.sede === id)?.monto ?? 0) || ""} />
                        </label>
                      ))}
                      <button className="btn">Guardar meta</button>
                    </form>
                  </Modal>
                )}
              </div>
            </div>
          )}
          <Sparkles className="hero-deco" aria-hidden />
        </section>

        {veDinero && (
          <Link className="card caja-turno" href="/panel/caja">
            <div className="caja-head">
              <span className="caja-ico"><Wallet className="i" /></span>
              <div><b>Caja de hoy</b><small>{sede ? "Sede elegida" : "Las tres sedes"}</small></div>
              <span className={`badge ${t.caja.cerrada ? "b-good" : "b-info"}`}>{t.caja.cerrada ? "Cerrada" : "Abierta"}</span>
            </div>
            <div className="caja-neto"><Contador valor={t.caja.ingresos - t.caja.egresos} soles /><small>neto del día</small></div>
            <dl className="caja-filas">
              <div><dt>Entró</dt><dd className="pos">{S(t.caja.ingresos)}</dd></div>
              <div><dt>Salió</dt><dd className="neg">{S(t.caja.egresos)}</dd></div>
              <div><dt>Efectivo</dt><dd>{S(t.caja.efectivo)}</dd></div>
              <div><dt>Yape, Plin y otros</dt><dd>{S(t.caja.digital)}</dd></div>
            </dl>
            <span className="caja-go">Abrir caja <ChevronRight className="i" /></span>
          </Link>
        )}
      </div>

      <div className="tcards">
        {veDinero && (
          <Link className="tcard" data-modulo="cobros" href="/panel/reportes">
            <span className="tcard-ico"><HandCoins /></span>
            <span className="tcard-q">Ingresos del mes</span>
            <span className="tcard-v"><Contador valor={t.ingresosMes} soles /></span>
            <span className="tcard-s">
              {t.variacion === null ? "Sin datos del mes pasado" : (
                <>{t.variacion >= 0 ? <ArrowUpRight className="i" /> : <ArrowDownRight className="i" />}{Math.abs(Math.round(t.variacion))}% vs. el mes pasado</>
              )}
            </span>
          </Link>
        )}
        <Link className="tcard" data-modulo="clientes" href="/panel/calendario">
          <span className="tcard-ico"><Camera /></span>
          <span className="tcard-q">Sesiones en proceso</span>
          <span className="tcard-v"><Contador valor={t.sesiones} /></span>
          <span className="tcard-s">{t.tomasHoy} {t.tomasHoy === 1 ? "toma hoy" : "tomas hoy"}</span>
        </Link>
        <Link className="tcard" data-modulo="produccion" href="/panel/produccion">
          <span className="tcard-ico"><PackageCheck /></span>
          <span className="tcard-q">Laboratorio</span>
          <span className="tcard-v"><Contador valor={t.procesados + t.paraEntregar} /></span>
          <span className="tcard-s">{t.procesados} por imprimir · {t.paraEntregar} por entregar</span>
        </Link>
        {veDinero && (
          <Link className="tcard" data-modulo="inventario" href="/panel/reportes#deudores">
            <span className="tcard-ico"><Wallet /></span>
            <span className="tcard-q">Saldos por cobrar</span>
            <span className="tcard-v"><Contador valor={t.porCobrar} soles /></span>
            <span className="tcard-s">{t.conSaldo} {t.conSaldo === 1 ? "pedido con saldo" : "pedidos con saldo"}</span>
          </Link>
        )}
      </div>

      <div className="grid-2 tab-graficos">
        {veDinero && (
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Evolución de ingresos</h2>
                <p>{S(totalRango)} cobrados en {rango} días</p>
              </div>
              <nav className="segmented" aria-label="Rango de días">
                {RANGOS.map((r) => (
                  <Link key={r} href={`/panel?dias=${r}`} scroll={false} aria-current={r === rango ? "true" : undefined}><span>{r} días</span></Link>
                ))}
              </nav>
            </div>
            <div className="card-body">
            <Barras
              grupos={t.serie.map((x) => ({ etiqueta: etiquetaDia(x.dia), valores: [x.monto] }))}
              series={["Cobrado"]}
              resaltar={t.serie.length - 1}
              meta={t.metaDiaria > 0 ? { valor: t.metaDiaria, texto: "Meta diaria" } : undefined}
              etiquetaCada={rango === 7 ? 1 : rango === 30 ? 5 : 10}
            />
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Demanda por tipo</h2>
              <p>Pedidos de los últimos 90 días</p>
            </div>
          </div>
          <div className="card-body">
          <Dona
            partes={t.demanda.map((x) => ({ nombre: TIPO_CAMPANA[x.tipo] ?? "Otro", valor: x.n }))}
            centro={{ valor: String(totalDemanda), texto: "pedidos" }}
            formato="num"
          />
          </div>
        </div>
      </div>

      <div className="grid-2">
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Próximas sesiones</h2>
            <p>Campañas abiertas ordenadas por día de toma</p>
          </div>
          <Link className="btn secondary sm" href="/panel/colegios">Ver colegios</Link>
        </div>
        {(proximas.data ?? []).length === 0 ? (
          <Empty icon={CalendarDays} title="Sin campañas abiertas">Crea una campaña desde la ficha de un colegio.</Empty>
        ) : (
          <div className="list">
            {(proximas.data ?? []).map((c) => {
              const colegio = c.colegios as unknown as { nombre: string } | null;
              const n = (c.alumnos as unknown as { count: number }[])[0]?.count ?? 0;
              return (
                <Link className="item" key={c.id} href={`/panel/campanas/${c.id}`}>
                  <div className="main">
                    <Avatar name={colegio?.nombre ?? c.nombre} square />
                    <div>
                      <div className="title">{colegio?.nombre}</div>
                      <div className="meta">{c.nombre} · {TIPO_CAMPANA[c.tipo]} · {n} alumnos</div>
                    </div>
                  </div>
                  <div className="end">
                    {c.fecha_captura ? (
                      <span className="badge b-info">{fecha(c.fecha_captura + "T12:00:00-05:00")}</span>
                    ) : (
                      <span className="badge b-warn">Sin fecha</span>
                    )}
                    <ChevronRight className="i chev" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Pendientes de hoy</h2>
            <p>Recordatorios y materiales por comprar</p>
          </div>
        </div>
        {(tareas.data ?? []).length === 0 && bajos.length === 0 ? (
          <Empty icon={CircleCheck} title="Todo al día">No hay recordatorios vencidos ni materiales por agotarse.</Empty>
        ) : (
          <div className="list">
            {(tareas.data ?? []).map((t) => (
              <Link className="item" key={t.id} href={t.oportunidad_id ? `/panel/clientes/${t.oportunidad_id}` : "/panel/clientes?vista=tareas"}>
                <div className="main">
                  <span className="dot-ico"><ListTodo className="i" /></span>
                  <div>
                    <div className="title">{t.titulo}</div>
                    <div className="meta">{(t.colegios as unknown as { nombre: string } | null)?.nombre ?? "Recordatorio"}</div>
                  </div>
                </div>
                <div className="end"><span className={`badge ${t.vence < dias[6] ? "b-bad" : "b-warn"}`}>{t.vence < dias[6] ? "Vencido" : "Hoy"}</span></div>
              </Link>
            ))}
            {bajos.slice(0, 4).map((m) => (
              <Link className="item" key={m.id} href="/panel/inventario">
                <div className="main">
                  <span className="dot-ico warn"><Boxes className="i" /></span>
                  <div>
                    <div className="title">Comprar {m.nombre}</div>
                    <div className="meta">Quedan {Number(m.stock)} {m.unidad}</div>
                  </div>
                </div>
                <div className="end"><span className="badge b-warn">Stock bajo</span></div>
              </Link>
            ))}
          </div>
        )}
      </div>
      </div>

      <div className="quick">
        <Link href="/panel/clientes">
          <span className="ico"><Handshake /></span>
          <span><b>Clientes</b><span>Colegios por conseguir</span></span>
        </Link>
        <Link href="/panel/produccion">
          <span className="ico"><Factory /></span>
          <span><b>Producción</b><span>Qué falta editar, imprimir y entregar</span></span>
        </Link>
        {veDinero && (
          <Link href="/panel/cobros">
            <span className="ico"><Wallet /></span>
            <span><b>Cobros</b><span>Quién pagó y quién debe</span></span>
          </Link>
        )}
      </div>
    </>
  );
}
