import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, Plus, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { PERMISOS, requirePerfil } from "@/lib/auth";
import { resumenCaja } from "@/lib/caja";
import { CATEGORIAS_GASTO, CATEGORIAS_INGRESO, S, hoyLima } from "@/lib/formato";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Empty, PageHeader } from "@/components/ui";
import { cerrarCaja, registrarMovimiento } from "../acciones-erp";

const METODO: Record<string, string> = { efectivo: "Efectivo", yape: "Yape", plin: "Plin", transferencia: "Transferencia", tarjeta: "Tarjeta" };
const hora = (iso: string) => new Intl.DateTimeFormat("es-PE", { hour: "numeric", minute: "2-digit", timeZone: "America/Lima" }).format(new Date(iso));
const mover = (f: string, d: number) => new Date(new Date(f + "T12:00:00Z").getTime() + d * 86400000).toISOString().slice(0, 10);

export default async function Caja({ searchParams }: { searchParams: Promise<{ fecha?: string; nuevo?: string; ok?: string; error?: string }> }) {
  const { fecha: f, nuevo, ...aviso } = await searchParams;
  const { supabase } = await requirePerfil(PERMISOS.caja);
  const hoy = hoyLima();
  const fecha = f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : hoy;
  const r = await resumenCaja(supabase, fecha);
  const { data: cierres } = await supabase.from("cierres_caja").select("fecha, efectivo_esperado, efectivo_contado, diferencia").order("fecha", { ascending: false }).limit(7);
  const volver = `/panel/caja${fecha !== hoy ? `?fecha=${fecha}` : ""}`;
  const largo = new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(fecha + "T12:00:00Z"));
  const titulo = largo.charAt(0).toUpperCase() + largo.slice(1);

  // Lista única ordenada por hora: pagos de pedidos y movimientos manuales.
  const filas = [
    ...r.pagos.map((p) => ({
      id: p.id, hora: p.creado_en, tipo: "ingreso" as const, metodo: p.metodo, monto: Number(p.monto),
      concepto: `Pedido N.º ${p.pedidos?.numero} · ${p.pedidos?.alumnos?.apellidos ?? ""}`, categoria: "Venta",
    })),
    ...r.movimientos.map((m) => ({ id: m.id, hora: m.creado_en, tipo: m.tipo, metodo: m.metodo, monto: Number(m.monto), concepto: m.concepto, categoria: m.categoria })),
  ].sort((a, b) => a.hora.localeCompare(b.hora));

  const formMovimiento = (tipo: "ingreso" | "egreso") => (
    <form action={registrarMovimiento} className="form">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="fecha" value={fecha} />
      <input type="hidden" name="volver" value={volver} />
      <div className="fields">
        <label className="field">
          Categoría
          <select name="categoria">{(tipo === "egreso" ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO).map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="field">Monto (S/)<input name="monto" inputMode="decimal" required placeholder="0.00" /></label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>Detalle<input name="concepto" placeholder={tipo === "egreso" ? "Pasaje a Iquitos para recoger impresiones" : "Fondo para el vuelto"} /></label>
        <label className="field">
          Cómo
          <select name="metodo">{Object.entries(METODO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </label>
      </div>
      <div className="form-foot"><button className="btn" type="submit">Guardar</button></div>
    </form>
  );

  return (
    <>
      <PageHeader
        modulo="caja"
        title="Caja"
        subtitle={titulo}
        actions={
          <>
            <div className="daynav">
              <Link className="icon-btn lg" href={`/panel/caja?fecha=${mover(fecha, -1)}`} aria-label="Día anterior"><ChevronLeft className="i" /></Link>
              {fecha !== hoy && <Link className="btn ghost sm" href="/panel/caja">Hoy</Link>}
              {fecha < hoy && <Link className="icon-btn lg" href={`/panel/caja?fecha=${mover(fecha, 1)}`} aria-label="Día siguiente"><ChevronRight className="i" /></Link>}
            </div>
            <Modal variant="secondary" label="Ingreso" title="Otro ingreso" icon={<Plus className="i" />}>{formMovimiento("ingreso")}</Modal>
            <Modal abrir={nuevo === "1"} label="Gasto" title="Nuevo gasto" icon={<Receipt className="i" />}>{formMovimiento("egreso")}</Modal>
          </>
        }
      />
      <Aviso {...aviso} />

      <div className="kpis">
        <div className="kpi">
          <div className="top">Entró <span className="ico"><TrendingUp className="i" /></span></div>
          <div className="val">{S(r.ingresos)}</div>
          <div className="sub">{S(r.ingresosPedidos)} de pedidos{r.otrosIngresos > 0 && ` + ${S(r.otrosIngresos)} otros`}</div>
        </div>
        <div className="kpi">
          <div className="top">Salió <span className="ico bad"><TrendingDown className="i" /></span></div>
          <div className="val">{S(r.egresos)}</div>
          <div className="sub">{r.movimientos.filter((m) => m.tipo === "egreso").length} gastos</div>
        </div>
        <div className="kpi">
          <div className="top">Resultado del día <span className="ico info"><Wallet className="i" /></span></div>
          <div className={`val ${r.neto < 0 ? "neg" : ""}`}>{S(r.neto)}</div>
          <div className="sub">{r.porMetodo.map((m) => `${METODO[m.metodo]} ${S(m.monto)}`).join(" · ") || "Sin cobros"}</div>
        </div>
        <div className="kpi">
          <div className="top">Efectivo en caja <span className="ico warn"><Lock className="i" /></span></div>
          <div className="val">{S(r.efectivo)}</div>
          <div className="sub">lo que debería haber en el cajón</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div><h2>Movimientos</h2><p>Cobros confirmados, otros ingresos y gastos del día.</p></div></div>
          {filas.length === 0 ? (
            <Empty icon={Wallet} title="Sin movimientos">Los pagos confirmados aparecen solos; los gastos se anotan con “Gasto”.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Hora</th><th>Detalle</th><th>Cómo</th><th className="num">Monto</th></tr></thead>
                <tbody>
                  {filas.map((x) => (
                    <tr key={x.id}>
                      <td className="muted">{hora(x.hora)}</td>
                      <td><b>{x.concepto}</b><br /><small className="muted">{x.categoria}</small></td>
                      <td>{METODO[x.metodo]}</td>
                      <td className={`num money ${x.tipo === "egreso" ? "neg" : "pos"}`}>{x.tipo === "egreso" ? "−" : "+"}{S(x.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <div className="card">
            <div className="card-head"><div><h2>Cierre del día</h2><p>Cuenta el efectivo y compáralo con el sistema.</p></div></div>
            <div className="card-body">
              {r.cierre ? (
                <dl className="info-list">
                  <div><dt>Debía haber</dt><dd>{S(r.cierre.efectivo_esperado)}</dd></div>
                  <div><dt>Se contó</dt><dd>{S(r.cierre.efectivo_contado)}</dd></div>
                  <div>
                    <dt>Diferencia</dt>
                    <dd>
                      {Number(r.cierre.diferencia) === 0 ? <span className="badge b-good">Cuadra exacto</span> : (
                        <span className={`badge ${Number(r.cierre.diferencia) > 0 ? "b-info" : "b-bad"}`}>
                          {Number(r.cierre.diferencia) > 0 ? "Sobra" : "Falta"} {S(Math.abs(Number(r.cierre.diferencia)))}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div><dt>Cerró</dt><dd>{(r.cierre.perfiles as { nombre: string } | null)?.nombre ?? "—"}{r.cierre.notas && ` · ${r.cierre.notas}`}</dd></div>
                </dl>
              ) : (
                <form action={cerrarCaja} className="form">
                  <input type="hidden" name="fecha" value={fecha} />
                  <input type="hidden" name="volver" value={volver} />
                  <div className="expected">Debería haber <b>{S(r.efectivo)}</b> en efectivo</div>
                  <label className="field">Efectivo contado (S/)<input name="efectivo_contado" inputMode="decimal" required placeholder="0.00" /></label>
                  <label className="field">Nota (opcional)<input name="notas" placeholder="Se dio vuelto de más a…" /></label>
                  <button className="btn block" type="submit"><Lock className="i" /> Cerrar caja</button>
                </form>
              )}
            </div>
          </div>
          {(cierres ?? []).length > 0 && (
            <div className="card detalle">
              <div className="card-head"><h2>Últimos cierres</h2></div>
              <div className="list">
                {(cierres ?? []).map((c) => (
                  <Link className="item" key={c.fecha} href={`/panel/caja?fecha=${c.fecha}`}>
                    <div className="main"><div><div className="title">{new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(c.fecha + "T12:00:00Z"))}</div><div className="meta">Contado {S(c.efectivo_contado)}</div></div></div>
                    <div className="end">
                      <span className={`badge ${Number(c.diferencia) === 0 ? "b-good" : Number(c.diferencia) > 0 ? "b-info" : "b-bad"}`}>
                        {Number(c.diferencia) === 0 ? "Cuadra" : `${Number(c.diferencia) > 0 ? "+" : "−"}${S(Math.abs(Number(c.diferencia)))}`}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
