import { filtroSede } from "@/lib/sedes";
import Link from "next/link";
import { ArrowUpRight, Search, Truck, Boxes, CalendarDays, ChevronRight, CircleAlert, CircleCheck, Factory, HandCoins, Handshake, ListTodo, PackageCheck, School, Sparkles, Wallet } from "lucide-react";
import { requirePerfil, puede } from "@/lib/auth";
import { S, TIPO_CAMPANA, fecha, saludo } from "@/lib/formato";
import { Avatar, Empty } from "@/components/ui";
import { Contador } from "@/components/contador";
import { Sparkline } from "@/components/sparkline";

export default async function Inicio() {
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
  const cobradoSemana = porDia.reduce((a, b) => a + b, 0);
  const letras = dias.map((d, i) =>
    i === 6 ? "Hoy" : new Intl.DateTimeFormat("es-PE", { weekday: "narrow", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z")),
  );
  const porCobrar = (saldos?.data ?? []).reduce((s, p) => s + Number(p.saldo), 0);
  const conSaldo = saldos?.data?.length ?? 0;
  const nVerificar = porVerificar?.count ?? 0;
  const dia = new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Lima" }).format(new Date());
  const hoyTexto = dia.charAt(0).toUpperCase() + dia.slice(1);

  // Vista sencilla: cuatro respuestas grandes y tres acciones, nada más.
  if (perfil.preferencias.vista === "sencilla") {
    const pendientesHoy = (tareas.data ?? []).length + bajos.length;
    return (
      <>
        <header className="hello">
          <p>{hoyTexto}</p>
          <h1>{saludo()}, {perfil.nombre.split(" ")[0]}</h1>
        </header>

        {nVerificar > 0 && (
          <Link className="banner" href="/panel/cobros#verificar">
            <CircleAlert className="i" />
            <span><b>{nVerificar === 1 ? "Hay 1 pago de Yape o Plin" : `Hay ${nVerificar} pagos de Yape o Plin`} por confirmar.</b> Revisa el celular del negocio.</span>
            <span className="banner-go">Revisar <ChevronRight className="i" /></span>
          </Link>
        )}

        <div className="answers">
          {veDinero && (
            <Link className="answer" data-modulo="cobros" href="/panel/caja">
              <span className="answer-ico"><Wallet /></span>
              <span className="answer-q">Hoy entró</span>
              <span className="answer-v"><Contador valor={cobradoHoy} soles /></span>
              <span className="answer-s">Ver la caja del día</span>
            </Link>
          )}
          {veDinero && (
            <Link className="answer" data-modulo="caja" href="/panel/reportes#deudores">
              <span className="answer-ico"><HandCoins /></span>
              <span className="answer-q">Falta cobrar</span>
              <span className="answer-v"><Contador valor={porCobrar} soles /></span>
              <span className="answer-s">{conSaldo} {conSaldo === 1 ? "pedido con saldo" : "pedidos con saldo"}</span>
            </Link>
          )}
          <Link className="answer" data-modulo="produccion" href="/panel/produccion?vista=entregas">
            <span className="answer-ico"><PackageCheck /></span>
            <span className="answer-q">Listos para entregar</span>
            <span className="answer-v"><Contador valor={listos.count ?? 0} /></span>
            <span className="answer-s">pedidos ya impresos</span>
          </Link>
          <Link className="answer" data-modulo="clientes" href="/panel/clientes?vista=tareas">
            <span className="answer-ico"><ListTodo /></span>
            <span className="answer-q">Pendientes de hoy</span>
            <span className="answer-v"><Contador valor={pendientesHoy} /></span>
            <span className="answer-s">{pendientesHoy === 0 ? "todo al día" : "recordatorios y compras"}</span>
          </Link>
        </div>

        <h2 className="ask">¿Qué quieres hacer?</h2>
        <div className="big-actions">
          {veDinero && (
            <Link className="big-action primary" href="/panel/cobros">
              <HandCoins /> <span><b>Registrar un pago</b><small>Efectivo, Yape o Plin</small></span>
            </Link>
          )}
          <Link className="big-action" href="/panel/buscar">
            <Search /> <span><b>Buscar un alumno</b><small>Por apellido o código</small></span>
          </Link>
          <Link className="big-action" href="/panel/produccion?vista=entregas">
            <Truck /> <span><b>Entregar pedidos</b><small>Lista por salón</small></span>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <section className="hero">
        <div className="hero-main">
          <p className="hero-date">{hoyTexto}</p>
          <h1>{saludo()}, {perfil.nombre.split(" ")[0]}</h1>
          {veDinero ? (
            <>
              <div className="hero-label">Cobrado hoy</div>
              <div className="hero-val"><Contador valor={cobradoHoy} soles /></div>
              <div className="hero-sub">{S(cobradoSemana)} en los últimos 7 días</div>
            </>
          ) : (
            <p className="hero-sub">Este es el resumen del estudio para hoy.</p>
          )}
          <div className="hero-actions">
            {veDinero && (
              <Link className="btn light" href="/panel/cobros">
                <HandCoins className="i" /> Registrar un pago
              </Link>
            )}
            <Link className="btn glass" href="/panel/colegios">
              <School className="i" /> Colegios
            </Link>
          </div>
        </div>
        {veDinero && (
          <div className="hero-chart">
            <Sparkline datos={porDia} etiquetas={letras} />
          </div>
        )}
        <Sparkles className="hero-deco" aria-hidden />
      </section>

      <div className="kpis">
        {veDinero && (
          <Link className="kpi" href="/panel/cobros">
            <div className="top">Por cobrar <span className="ico warn"><HandCoins className="i" /></span></div>
            <div className="val"><Contador valor={porCobrar} soles /></div>
            <div className="sub">{conSaldo} {conSaldo === 1 ? "pedido con saldo" : "pedidos con saldo"} <ArrowUpRight className="i go" /></div>
          </Link>
        )}
        <Link className="kpi" href="/panel/produccion">
          <div className="top">Listos para entregar <span className="ico info"><PackageCheck className="i" /></span></div>
          <div className="val"><Contador valor={listos.count ?? 0} /></div>
          <div className="sub">Pedidos ya impresos <ArrowUpRight className="i go" /></div>
        </Link>
        {veDinero &&
          (nVerificar > 0 ? (
            <Link className="kpi alert" href="/panel/cobros#verificar">
              <div className="top">Pagos por verificar <span className="ico bad"><CircleAlert className="i" /></span></div>
              <div className="val"><Contador valor={nVerificar} /></div>
              <div className="sub">Yape o Plin por confirmar <ArrowUpRight className="i go" /></div>
            </Link>
          ) : (
            <div className="kpi">
              <div className="top">Pagos por verificar <span className="ico"><Wallet className="i" /></span></div>
              <div className="val">0</div>
              <div className="sub">Todo al día</div>
            </div>
          ))}
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
