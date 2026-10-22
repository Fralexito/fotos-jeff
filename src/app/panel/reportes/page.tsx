import Link from "next/link";
import { Download, HandCoins, Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import { PERMISOS, requirePerfil } from "@/lib/auth";
import { S, whatsapp } from "@/lib/formato";
import { deudores } from "@/lib/reportes";
import { Avatar, Empty, PageHeader, WhatsApp } from "@/components/ui";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];

export default async function Reportes({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const { anio: a } = await searchParams;
  const { supabase } = await requirePerfil(PERMISOS.reportes);
  const actual = new Date().getFullYear();
  const anio = Number(a) || actual;
  const desde = `${anio}-01-01T00:00:00-05:00`;
  const hasta = `${anio + 1}-01-01T00:00:00-05:00`;

  const [{ data: campanas }, { data: pagos }, { data: gastos }, { data: items }, lista] = await Promise.all([
    supabase.from("campanas").select("id, nombre, colegio_id, colegios(nombre)").eq("anio", anio),
    supabase.from("pagos").select("monto, creado_en").eq("estado", "confirmado").gte("creado_en", desde).lt("creado_en", hasta),
    supabase.from("movimientos_caja").select("monto, categoria").eq("tipo", "egreso").gte("fecha", `${anio}-01-01`).lt("fecha", `${anio + 1}-01-01`),
    supabase
      .from("pedido_items")
      .select("cantidad, precio_unitario, productos(nombre), pedidos!inner(estado, campanas!inner(anio))")
      .eq("pedidos.campanas.anio", anio)
      .neq("pedidos.estado", "anulado"),
    deudores(supabase),
  ]);

  const idsCamp = (campanas ?? []).map((c) => c.id);
  const { data: saldos } = idsCamp.length
    ? await supabase.from("pedidos_saldo").select("campana_id, total, pagado, saldo").in("campana_id", idsCamp).neq("estado", "anulado")
    : { data: [] as { campana_id: string; total: number; pagado: number; saldo: number }[] };

  // Ventas por colegio.
  const porColegio = new Map<string, { id: string; nombre: string; pedidos: number; vendido: number; cobrado: number; saldo: number }>();
  for (const s of saldos ?? []) {
    const c = (campanas ?? []).find((x) => x.id === s.campana_id);
    if (!c) continue;
    const nombre = (c.colegios as unknown as { nombre: string } | null)?.nombre ?? c.nombre;
    const fila = porColegio.get(c.colegio_id) ?? { id: c.colegio_id, nombre, pedidos: 0, vendido: 0, cobrado: 0, saldo: 0 };
    fila.pedidos += 1; fila.vendido += Number(s.total); fila.cobrado += Number(s.pagado); fila.saldo += Number(s.saldo);
    porColegio.set(c.colegio_id, fila);
  }
  const colegios = [...porColegio.values()].sort((x, y) => y.vendido - x.vendido);
  const vendido = colegios.reduce((s, c) => s + c.vendido, 0);
  const nPedidos = colegios.reduce((s, c) => s + c.pedidos, 0);

  const meses = MESES.map((_, i) =>
    (pagos ?? []).filter((p) => Number(new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "America/Lima" }).format(new Date(p.creado_en))) === i + 1)
      .reduce((s, p) => s + Number(p.monto), 0),
  );
  const cobrado = meses.reduce((s, m) => s + m, 0);
  const gastado = (gastos ?? []).reduce((s, g) => s + Number(g.monto), 0);
  const maxMes = Math.max(...meses, 1);

  const productos = new Map<string, { cantidad: number; monto: number }>();
  for (const it of items ?? []) {
    const n = (it.productos as unknown as { nombre: string } | null)?.nombre ?? "—";
    const f = productos.get(n) ?? { cantidad: 0, monto: 0 };
    f.cantidad += it.cantidad; f.monto += it.cantidad * Number(it.precio_unitario);
    productos.set(n, f);
  }
  const top = [...productos.entries()].sort((x, y) => y[1].monto - x[1].monto).slice(0, 8);
  const maxProd = Math.max(...top.map(([, v]) => v.monto), 1);
  const deuda = lista.reduce((s, d) => s + d.saldo, 0);

  return (
    <>
      <PageHeader
        modulo="reportes"
        title="Reportes"
        subtitle="Cómo va el negocio: ventas, cobros, gastos y quién debe."
        actions={
          <div className="seg-links">
            {[actual - 2, actual - 1, actual].map((y) => (
              <Link key={y} href={`/panel/reportes?anio=${y}`} aria-current={y === anio ? "page" : undefined}>{y}</Link>
            ))}
          </div>
        }
      />

      <div className="kpis">
        <div className="kpi"><div className="top">Vendido {anio} <span className="ico"><ShoppingBag className="i" /></span></div><div className="val">{S(vendido)}</div><div className="sub">{nPedidos} pedidos · ticket {S(nPedidos ? vendido / nPedidos : 0)}</div></div>
        <div className="kpi"><div className="top">Cobrado {anio} <span className="ico info"><TrendingUp className="i" /></span></div><div className="val">{S(cobrado)}</div><div className="sub">pagos confirmados</div></div>
        <div className="kpi"><div className="top">Gastos {anio} <span className="ico bad"><Receipt className="i" /></span></div><div className="val">{S(gastado)}</div><div className="sub">quedan {S(cobrado - gastado)} libres</div></div>
        <div className={`kpi${deuda > 0 ? " alert" : ""}`}><div className="top">Por cobrar (total) <span className="ico warn"><HandCoins className="i" /></span></div><div className="val">{S(deuda)}</div><div className="sub">{lista.length} pedidos con saldo</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div><h2>Cobros por mes</h2><p>Dinero confirmado que entró cada mes de {anio}.</p></div></div>
          <div className="card-body">
            <div className="bars" role="img" aria-label={`Cobros por mes de ${anio}`}>
              {meses.map((m, i) => (
                <div className="bar" key={i} title={`${MESES[i]}: ${S(m)}`}>
                  <span className="bar-val">{m > 0 ? (m >= 1000 ? `${(m / 1000).toFixed(1)}k` : Math.round(m)) : ""}</span>
                  <span className="bar-fill" style={{ height: `${(m / maxMes) * 100}%`, animationDelay: `${i * 30}ms` }} />
                  <span className="bar-label">{MESES[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div><h2>Lo que más se vende</h2><p>Productos de las campañas {anio}.</p></div></div>
          {top.length === 0 ? <Empty icon={ShoppingBag} title="Sin ventas este año" /> : (
            <div className="card-body hbars">
              {top.map(([n, v]) => (
                <div className="hbar" key={n}>
                  <div className="hbar-top"><span>{n}</span><span className="money">{S(v.monto)} <small className="muted">· {v.cantidad} u.</small></span></div>
                  <div className="progress"><span style={{ width: `${(v.monto / maxProd) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div><h2>Ventas por colegio</h2><p>Campañas {anio}.</p></div></div>
        {colegios.length === 0 ? <Empty icon={TrendingUp} title={`Sin campañas en ${anio}`} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Colegio</th><th className="num">Pedidos</th><th className="num">Vendido</th><th className="num">Cobrado</th><th className="num">Debe</th><th style={{ width: 160 }}>Avance de cobro</th></tr></thead>
              <tbody>
                {colegios.map((c) => {
                  const pct = c.vendido ? (c.cobrado / c.vendido) * 100 : 0;
                  return (
                    <tr key={c.id}>
                      <td><Link className="person" href={`/panel/colegios/${c.id}`}><Avatar name={c.nombre} square /><b>{c.nombre}</b></Link></td>
                      <td className="num">{c.pedidos}</td>
                      <td className="num money">{S(c.vendido)}</td>
                      <td className="num">{S(c.cobrado)}</td>
                      <td className="num">{c.saldo > 0 ? <span className="neg">{S(c.saldo)}</span> : "—"}</td>
                      <td><div className="progress-row"><div className={`progress ${pct >= 90 ? "b-good" : pct >= 50 ? "b-warn" : "b-bad"}`}><span style={{ width: `${pct}%` }} /></div><small>{Math.round(pct)}%</small></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" id="deudores">
        <div className="card-head">
          <div><h2>Quién debe</h2><p>Todos los pedidos con saldo, de mayor a menor. El botón manda un recordatorio amable por WhatsApp.</p></div>
          {lista.length > 0 && <a className="btn secondary sm" href="/panel/reportes/deudores" download><Download className="i" /> Descargar Excel</a>}
        </div>
        {lista.length === 0 ? <Empty icon={HandCoins} title="Nadie debe">Todos los pedidos están pagados.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Alumno</th><th>Colegio</th><th className="num">Total</th><th className="num">Debe</th><th></th></tr></thead>
              <tbody>
                {lista.slice(0, 50).map((d) => (
                  <tr key={d.id}>
                    <td><b>{d.alumno}</b><br /><small className="muted">N.º {d.numero}{d.salon && ` · ${d.salon}`}</small></td>
                    <td>{d.colegio}<br /><small className="muted">{d.campana}</small></td>
                    <td className="num">{S(d.total)}</td>
                    <td className="num money neg">{S(d.saldo)}</td>
                    <td className="num">
                      <WhatsApp
                        label="Recordar"
                        href={whatsapp(d.telefono, `Hola, le saluda Fotos Jefferson. Le recordamos que el pedido N.º ${d.numero} de ${d.alumno.split(", ")[1] ?? d.alumno} tiene un saldo de ${S(d.saldo)}. Puede pagar por Yape o Plin. ¡Gracias!`)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lista.length > 50 && <p className="muted-text" style={{ padding: "0 20px 16px" }}>Se muestran 50 de {lista.length}. Descarga el Excel para ver todos.</p>}
          </div>
        )}
      </div>
    </>
  );
}
