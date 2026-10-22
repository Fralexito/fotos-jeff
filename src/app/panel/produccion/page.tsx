import Link from "next/link";
import { ChevronRight, Factory, PackageCheck, Truck } from "lucide-react";
import { requirePerfil } from "@/lib/auth";
import { ESTADO_PEDIDO, S, whatsapp } from "@/lib/formato";
import { Aviso } from "@/components/aviso";
import { Imprimir } from "@/components/imprimir";
import { Empty, PageHeader, Tabs, WhatsApp } from "@/components/ui";
import { cambiarEstadoPedido, entregarPedidos } from "../acciones-erp";

// El camino de cada pedido, con el nombre que usa el estudio.
const ETAPAS = [
  { estado: "pendiente", titulo: "Por editar", siguiente: "procesado", accion: "Editado" },
  { estado: "procesado", titulo: "Editado", siguiente: "en_impresion", accion: "Impreso" },
  { estado: "en_impresion", titulo: "Listo para entregar", siguiente: "entregado", accion: "Entregado" },
  { estado: "entregado", titulo: "Entregado", siguiente: null, accion: null },
] as const;

type Pedido = {
  id: string; numero: number; estado: string; total: number; campana_id: string; entregado_en: string | null;
  alumnos: { nombres: string; apellidos: string; grado: string | null; seccion: string | null; apoderado_telefono: string | null } | null;
  campanas: { nombre: string; colegios: { nombre: string } | null } | null;
  pedido_items: { cantidad: number; productos: { nombre: string } | null }[];
};

export default async function Produccion({
  searchParams,
}: {
  searchParams: Promise<{ campana?: string; vista?: string; ok?: string; error?: string }>;
}) {
  const { campana = "", vista = "tablero", ...aviso } = await searchParams;
  const { supabase } = await requirePerfil();

  const { data: campanas } = await supabase
    .from("campanas")
    .select("id, nombre, colegios(nombre)")
    .neq("estado", "cerrada")
    .order("fecha_captura", { ascending: true, nullsFirst: false });

  let q = supabase
    .from("pedidos")
    .select("id, numero, estado, total, campana_id, entregado_en, alumnos(nombres, apellidos, grado, seccion, apoderado_telefono), campanas(nombre, colegios(nombre)), pedido_items(cantidad, productos(nombre))")
    .neq("estado", "anulado")
    .order("numero", { ascending: true })
    .limit(600);
  if (campana) q = q.eq("campana_id", campana);
  const { data } = await q.returns<Pedido[]>();
  const pedidos = data ?? [];

  const ids = pedidos.map((p) => p.id);
  const { data: saldos } = ids.length
    ? await supabase.from("pedidos_saldo").select("id, saldo").in("id", ids)
    : { data: [] as { id: string; saldo: number }[] };
  const saldo = new Map((saldos ?? []).map((s) => [s.id, Number(s.saldo)]));

  const base = `/panel/produccion${campana ? `?campana=${campana}` : ""}`;
  const conVista = (v: string) => `/panel/produccion?${new URLSearchParams({ ...(campana && { campana }), ...(v !== "tablero" && { vista: v }) })}`;
  const cuenta = (e: string) => pedidos.filter((p) => p.estado === e).length;
  const salon = (p: Pedido) => [p.alumnos?.grado, p.alumnos?.seccion].filter(Boolean).join(" ") || "Sin salón";
  const items = (p: Pedido) => p.pedido_items.map((i) => `${i.cantidad}× ${i.productos?.nombre ?? ""}`).join(", ");
  const avisoListo = (p: Pedido) =>
    whatsapp(p.alumnos?.apoderado_telefono, `Hola, le saluda Fotos Jeff. El pedido N.º ${p.numero} de ${p.alumnos?.nombres} ya está listo para recoger.${(saldo.get(p.id) ?? 0) > 0 ? ` Saldo pendiente: ${S(saldo.get(p.id))}.` : ""}`);

  return (
    <>
      <PageHeader
        title="Producción"
        subtitle="El camino de cada pedido: edición, impresión y entrega."
        actions={vista === "entregas" && campana ? <Imprimir label="Imprimir lista" /> : null}
      />
      <Aviso {...aviso} />

      <form className="filterbar" action="/panel/produccion">
        {vista !== "tablero" && <input type="hidden" name="vista" value={vista} />}
        <label className="field inline">
          Campaña
          <select name="campana" defaultValue={campana} className="input">
            <option value="">Todas las campañas abiertas</option>
            {(campanas ?? []).map((c) => (
              <option key={c.id} value={c.id}>{(c.colegios as unknown as { nombre: string } | null)?.nombre} · {c.nombre}</option>
            ))}
          </select>
        </label>
        <button className="btn secondary" type="submit">Ver</button>
      </form>

      <div className="stepper">
        {ETAPAS.map((e, i) => (
          <div key={e.estado} className="step">
            <span className="step-n">{cuenta(e.estado)}</span>
            <span>{e.titulo}</span>
            {i < ETAPAS.length - 1 && <ChevronRight className="i" />}
          </div>
        ))}
      </div>

      <Tabs
        items={[
          { href: conVista("tablero"), label: "Tablero", active: vista === "tablero" },
          { href: conVista("entregas"), label: "Entregas por salón", active: vista === "entregas" },
        ]}
      />

      {pedidos.length === 0 && (
        <div className="card"><Empty icon={Factory} title="No hay pedidos">Los pedidos aparecen aquí cuando se registran desde Cobros o desde la lista de alumnos.</Empty></div>
      )}

      {vista === "tablero" && pedidos.length > 0 && (
        <div className="board four">
          {ETAPAS.map((e) => {
            const lista = pedidos.filter((p) => p.estado === e.estado);
            const visibles = e.estado === "entregado" ? lista.slice(-20).reverse() : lista;
            return (
              <section className="column" key={e.estado}>
                <header>
                  <span className={`badge ${ESTADO_PEDIDO[e.estado][1]}`}>{e.titulo}</span>
                  <span className="col-count">{lista.length}</span>
                </header>
                {visibles.length === 0 && <p className="col-empty">Nada aquí</p>}
                {visibles.map((p) => (
                  <article className="deal" key={p.id}>
                    <div className="deal-main">
                      <b>N.º {p.numero} · {p.alumnos?.apellidos}, {p.alumnos?.nombres}</b>
                      <small>{p.campanas?.colegios?.nombre} · {salon(p)}</small>
                      <span className="deal-meta">
                        <span>{items(p) || "Sin productos"}</span>
                        {(saldo.get(p.id) ?? 0) > 0 ? <span className="late">Debe {S(saldo.get(p.id))}</span> : <span className="ok-text">Pagado</span>}
                      </span>
                    </div>
                    {e.siguiente && (
                      <footer>
                        {e.estado === "en_impresion" ? <WhatsApp href={avisoListo(p)} label="Avisar" /> : <span />}
                        <form action={cambiarEstadoPedido}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="estado" value={e.siguiente} />
                          <input type="hidden" name="volver" value={base} />
                          <button className="btn sm secondary">{e.accion} <ChevronRight className="i" /></button>
                        </form>
                      </footer>
                    )}
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {vista === "entregas" && pedidos.length > 0 && !campana && (
        <div className="card"><Empty icon={Truck} title="Elige una campaña">La lista de entregas se arma por colegio y salón.</Empty></div>
      )}

      {vista === "entregas" && campana && pedidos.length > 0 && (
        <form action={entregarPedidos}>
          <input type="hidden" name="volver" value={conVista("entregas")} />
          {[...new Set(pedidos.map(salon))].sort().map((s) => {
            const lista = pedidos.filter((p) => salon(p) === s).sort((a, b) => (a.alumnos?.apellidos ?? "").localeCompare(b.alumnos?.apellidos ?? ""));
            const listos = lista.filter((p) => p.estado === "en_impresion").length;
            const entregados = lista.filter((p) => p.estado === "entregado").length;
            return (
              <div className="card print-block" key={s}>
                <div className="card-head">
                  <div><h2>{s}</h2><p>{entregados} de {lista.length} entregados · {listos} listos</p></div>
                  <div className="progress" style={{ width: 140 }}><span style={{ width: `${(entregados / lista.length) * 100}%` }} /></div>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th style={{ width: 44 }}></th><th>Alumno</th><th>Productos</th><th>Estado</th><th className="num">Saldo</th><th className="no-print"></th></tr></thead>
                    <tbody>
                      {lista.map((p) => (
                        <tr key={p.id} className={p.estado === "entregado" ? "row-done" : ""}>
                          <td>
                            {p.estado === "entregado" ? <PackageCheck className="i ok-text" /> : (
                              <input type="checkbox" name="pedido" value={p.id} className="big-check" aria-label={`Entregar pedido ${p.numero}`} />
                            )}
                          </td>
                          <td><b>{p.alumnos?.apellidos}, {p.alumnos?.nombres}</b><br /><small className="muted">N.º {p.numero}</small></td>
                          <td>{items(p)}</td>
                          <td><span className={`badge ${ESTADO_PEDIDO[p.estado][1]}`}>{ETAPAS.find((e) => e.estado === p.estado)?.titulo}</span></td>
                          <td className="num">{(saldo.get(p.id) ?? 0) > 0 ? <span className="late money">{S(saldo.get(p.id))}</span> : "—"}</td>
                          <td className="num no-print">{p.estado === "en_impresion" && <WhatsApp href={avisoListo(p)} label="Avisar" />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          <div className="sticky-actions no-print">
            <span className="muted-text" style={{ margin: 0 }}>Marca los pedidos que se entregaron y confirma.</span>
            <button className="btn lg" type="submit"><Truck className="i" /> Registrar entrega</button>
          </div>
        </form>
      )}
      {vista === "tablero" && <p className="muted-text">El tablero muestra los últimos 20 entregados. <Link href={conVista("entregas")}>Ver por salón</Link></p>}
    </>
  );
}
