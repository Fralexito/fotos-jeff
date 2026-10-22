import Link from "next/link";
import { ArrowUpRight, CalendarDays, ChevronRight, CircleAlert, HandCoins, PackageCheck, School, Sparkles, Wallet } from "lucide-react";
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

  const [semana, saldos, listos, porVerificar, proximas] = await Promise.all([
    veDinero
      ? supabase.from("pagos").select("monto, creado_en").eq("estado", "confirmado").gte("creado_en", desde)
      : null,
    veDinero ? supabase.from("pedidos_saldo").select("saldo").neq("estado", "anulado").gt("saldo", 0) : null,
    supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("estado", "en_impresion"),
    veDinero
      ? supabase.from("pagos").select("id", { count: "exact", head: true }).eq("estado", "por_verificar")
      : null,
    supabase
      .from("campanas")
      .select("id, nombre, tipo, fecha_captura, colegios(nombre), alumnos(count)")
      .neq("estado", "cerrada")
      .order("fecha_captura", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

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
        <div className="kpi">
          <div className="top">Listos para entregar <span className="ico info"><PackageCheck className="i" /></span></div>
          <div className="val"><Contador valor={listos.count ?? 0} /></div>
          <div className="sub">Pedidos ya impresos</div>
        </div>
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

      <div className="quick">
        <Link href="/panel/colegios">
          <span className="ico"><School /></span>
          <span><b>Colegios y alumnos</b><span>Listas, secciones y fechas</span></span>
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
