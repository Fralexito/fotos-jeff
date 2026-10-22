import Link from "next/link";
import { CalendarDays, ChevronRight, CircleAlert, HandCoins, PackageCheck, School, Wallet } from "lucide-react";
import { requirePerfil, puede } from "@/lib/auth";
import { S, TIPO_CAMPANA, fecha, inicioDeHoyLima, saludo } from "@/lib/formato";
import { Avatar, Empty, PageHeader } from "@/components/ui";

export default async function Inicio() {
  const { supabase, perfil } = await requirePerfil();
  const veDinero = puede(perfil, "cobros");

  const [hoy, saldos, listos, porVerificar, proximas] = await Promise.all([
    veDinero
      ? supabase.from("pagos").select("monto").eq("estado", "confirmado").gte("creado_en", inicioDeHoyLima())
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

  const cobradoHoy = (hoy?.data ?? []).reduce((s, p) => s + Number(p.monto), 0);
  const porCobrar = (saldos?.data ?? []).reduce((s, p) => s + Number(p.saldo), 0);
  const conSaldo = saldos?.data?.length ?? 0;
  const nVerificar = porVerificar?.count ?? 0;
  const dia = new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Lima" }).format(new Date());
  const hoyTexto = dia.charAt(0).toUpperCase() + dia.slice(1);

  return (
    <>
      <PageHeader
        title={`${saludo()}, ${perfil.nombre.split(" ")[0]}`}
        subtitle={hoyTexto}
        actions={
          veDinero && (
            <Link className="btn" href="/panel/cobros">
              <HandCoins className="i" /> Registrar un pago
            </Link>
          )
        }
      />

      <div className="kpis">
        {veDinero && (
          <>
            <div className="kpi">
              <div className="top">Cobrado hoy <span className="ico"><Wallet className="i" /></span></div>
              <div className="val">{S(cobradoHoy)}</div>
              <div className="sub">Pagos confirmados desde las 0:00</div>
            </div>
            <Link className="kpi" href="/panel/cobros">
              <div className="top">Por cobrar <span className="ico warn"><HandCoins className="i" /></span></div>
              <div className="val">{S(porCobrar)}</div>
              <div className="sub">{conSaldo} {conSaldo === 1 ? "pedido con saldo" : "pedidos con saldo"}</div>
            </Link>
          </>
        )}
        <div className="kpi">
          <div className="top">Listos para entregar <span className="ico info"><PackageCheck className="i" /></span></div>
          <div className="val">{listos.count ?? 0}</div>
          <div className="sub">Pedidos ya impresos</div>
        </div>
        {nVerificar > 0 && (
          <Link className="kpi alert" href="/panel/cobros#verificar">
            <div className="top">Pagos por verificar <span className="ico bad"><CircleAlert className="i" /></span></div>
            <div className="val">{nVerificar}</div>
            <div className="sub">Yape o Plin por confirmar</div>
          </Link>
        )}
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
