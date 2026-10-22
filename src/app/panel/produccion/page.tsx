import Link from "next/link";
import { ChevronRight, Factory, PackageCheck, Truck } from "lucide-react";
import { filtroSede } from "@/lib/sedes";
import { requirePerfil } from "@/lib/auth";
import { ESTADO_PEDIDO, S, whatsapp } from "@/lib/formato";
import { Aviso } from "@/components/aviso";
import { Imprimir } from "@/components/imprimir";
import { Empty, PageHeader, Tabs, WhatsApp } from "@/components/ui";
import { cambiarEstadoPedido, entregarPedidos } from "../acciones-erp";
import { SimpleLista, SimpleTitulo } from "@/components/simple";

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
  searchParams: Promise<{ campana?: string; vista?: string; paso?: string; ok?: string; error?: string }>;
}) {
  const { campana = "", vista: pedida, paso = "", ...aviso } = await searchParams;
  const { supabase, perfil } = await requirePerfil();
  const sede = filtroSede(perfil.preferencias.sede);
  const sencilla = perfil.preferencias.vista === "sencilla";
  // En vista sencilla "Entregar fotos" abre directo la lista de entregas, no el tablero.
  const vista = pedida ?? (sencilla ? "entregas" : "tablero");

  let qCamp = supabase
    .from("campanas")
    .select("id, nombre, colegios!inner(nombre, sede)")
    .neq("estado", "cerrada")
    .order("fecha_captura", { ascending: true, nullsFirst: false });
  if (sede) qCamp = qCamp.eq("colegios.sede", sede);
  const { data: campanas } = await qCamp;

  let q = supabase
    .from("pedidos")
    .select("id, numero, estado, total, campana_id, entregado_en, alumnos(nombres, apellidos, grado, seccion, apoderado_telefono), campanas(nombre, colegios(nombre)), pedido_items(cantidad, productos(nombre))")
    .neq("estado", "anulado")
    .order("numero", { ascending: true })
    .limit(600);
  if (campana) q = q.eq("campana_id", campana);
  if (sede) q = q.eq("sede", sede);
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
    whatsapp(p.alumnos?.apoderado_telefono, `Hola, le saluda Fotos Jefferson. El pedido N.º ${p.numero} de ${p.alumnos?.nombres} ya está listo para recoger.${(saldo.get(p.id) ?? 0) > 0 ? ` Saldo pendiente: ${S(saldo.get(p.id))}.` : ""}`);

  // Vista sencilla: una pantalla por paso, botones grandes y nada de columnas.
  if (sencilla) {
    const deuda = (p: Pedido) => saldo.get(p.id) ?? 0;
    const nombre = (p: Pedido) => `${p.alumnos?.apellidos}, ${p.alumnos?.nombres}`;
    const elegida = (campanas ?? []).find((c) => c.id === campana);
    const colegioDe = (c: { colegios: unknown }) => (c.colegios as { nombre: string } | null)?.nombre ?? "";

    if (vista === "entregas" && !elegida) {
      return (
        <div className="simple">
          <SimpleTitulo titulo="Entregar fotos" sub="¿De qué colegio vas a entregar?" />
          <Aviso {...aviso} />
          <SimpleLista
            vacio="No hay colegios con pedidos abiertos."
            filas={(campanas ?? []).map((c) => {
              const listos = pedidos.filter((p) => p.campana_id === c.id && p.estado === "en_impresion").length;
              return { key: c.id, href: `/panel/produccion?vista=entregas&campana=${c.id}`, titulo: colegioDe(c), avatar: colegioDe(c), sub: c.nombre, valor: `${listos} ${listos === 1 ? "listo" : "listos"}`, tono: listos ? "bien" as const : "suave" as const };
            })}
          />
        </div>
      );
    }

    if (vista === "entregas" && elegida) {
      const salones = [...new Set(pedidos.map(salon))].sort();
      const listos = pedidos.filter((p) => p.estado === "en_impresion").length;
      return (
        <div className="simple">
          <SimpleTitulo titulo={colegioDe(elegida)} volver={{ href: "/panel/produccion?vista=entregas", texto: "Elegir otro colegio" }} sub={`${listos} ${listos === 1 ? "pedido listo" : "pedidos listos"} para entregar`} />
          <Aviso {...aviso} />
          {pedidos.length === 0 ? <p className="simple-vacio">Este colegio no tiene pedidos.</p> : (
            <form action={entregarPedidos} className="simple">
              <input type="hidden" name="volver" value={`/panel/produccion?vista=entregas&campana=${campana}`} />
              {salones.map((s) => {
                const lista = pedidos.filter((p) => salon(p) === s).sort((a, b) => (a.alumnos?.apellidos ?? "").localeCompare(b.alumnos?.apellidos ?? ""));
                const hechos = lista.filter((p) => p.estado === "entregado").length;
                return (
                  <section key={s} className="simple-dia">
                    <h2 className="simple-sub">{s} <small className="muted">· {hechos} de {lista.length} entregados</small></h2>
                    <div className="simple-lista">
                      {lista.map((p) => p.estado === "entregado" ? (
                        <div key={p.id} className="simple-item hecho">
                          <PackageCheck className="simple-ok" />
                          <span className="quien"><b>{nombre(p)}</b><small>Ya se entregó</small></span>
                        </div>
                      ) : (
                        <label key={p.id} className="simple-item simple-check">
                          <input type="checkbox" name="pedido" value={p.id} disabled={p.estado !== "en_impresion"} />
                          <span className="quien"><b>{nombre(p)}</b><small>{p.estado === "en_impresion" ? items(p) : "Todavía no está impreso"}</small>{deuda(p) > 0 && <small className="debe-txt">Debe {S(deuda(p))}</small>}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
              {listos > 0 && (
                <div className="simple-fijo">
                  <button className="btn" type="submit"><Truck className="i" /> Marcar como entregados</button>
                </div>
              )}
            </form>
          )}
        </div>
      );
    }

    const etapa = ETAPAS.find((e) => e.estado === paso);
    if (etapa) {
      const lista = pedidos.filter((p) => p.estado === etapa.estado);
      const visibles = etapa.estado === "entregado" ? lista.slice(-20).reverse() : lista;
      return (
        <div className="simple">
          <SimpleTitulo titulo={etapa.titulo} volver={{ href: "/panel/produccion?vista=tablero", texto: "Producción" }} sub={`${lista.length} ${lista.length === 1 ? "pedido" : "pedidos"}`} />
          <Aviso {...aviso} />
          {visibles.length === 0 && <p className="simple-vacio">No hay pedidos en este paso.</p>}
          <div className="simple-lista">
            {visibles.map((p) => (
              <div key={p.id} className="simple-item simple-paso">
                <span className="quien"><b>{nombre(p)}</b><small>{p.campanas?.colegios?.nombre} · {salon(p)}</small><small>{items(p) || "Sin productos"}{deuda(p) > 0 ? ` · Debe ${S(deuda(p))}` : ""}</small></span>
                {etapa.siguiente && (
                  <form action={cambiarEstadoPedido}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="estado" value={etapa.siguiente} />
                    <input type="hidden" name="volver" value={`/panel/produccion?vista=tablero&paso=${etapa.estado}`} />
                    <button className="btn">Ya está {etapa.accion?.toLowerCase()} <ChevronRight className="i" /></button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="simple">
        <SimpleTitulo titulo="Producción" sub="¿En qué paso van los pedidos?" />
        <Aviso {...aviso} />
        <SimpleLista
          vacio=""
          filas={ETAPAS.map((e) => ({ key: e.estado, href: `/panel/produccion?vista=tablero&paso=${e.estado}`, titulo: e.titulo, valor: String(cuenta(e.estado)), tono: cuenta(e.estado) && e.estado !== "entregado" ? "debe" as const : "suave" as const }))}
        />
        <div className="simple-acciones">
          <Link className="btn" href="/panel/produccion?vista=entregas"><Truck className="i" /> Entregar fotos</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        modulo="produccion"
        title={sencilla && vista === "entregas" ? "Entregar fotos" : "Producción"}
        subtitle={sencilla ? undefined : "El camino de cada pedido: edición, impresión y entrega."}
        crumbs={sencilla && vista === "entregas" && campana ? [{ href: "/panel/produccion?vista=entregas", label: "Elegir otro colegio" }] : undefined}
        actions={vista === "entregas" && campana ? <Imprimir label="Imprimir lista" /> : null}
      />
      <Aviso {...aviso} />

      <form className="filterbar detalle" action="/panel/produccion">
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

      <div className="stepper detalle">
        {ETAPAS.map((e, i) => (
          <div key={e.estado} className="step">
            <span className="step-n">{cuenta(e.estado)}</span>
            <span>{e.titulo}</span>
            {i < ETAPAS.length - 1 && <ChevronRight className="i" />}
          </div>
        ))}
      </div>

      <div className="detalle"><Tabs
        items={[
          { href: conVista("tablero"), label: "Tablero", active: vista === "tablero" },
          { href: conVista("entregas"), label: "Entregas por salón", active: vista === "entregas" },
        ]}
      /></div>

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
        <div className="card">
          <div className="card-head"><div><h2>¿De qué colegio vas a entregar?</h2><p>Toca uno para ver la lista por salón.</p></div></div>
          <div className="elige-colegio">
            {(campanas ?? []).map((c) => {
              const listos = pedidos.filter((p) => p.campana_id === c.id && p.estado === "en_impresion").length;
              const col = c.colegios as unknown as { nombre: string } | null;
              return (
                <Link key={c.id} href={`/panel/produccion?vista=entregas&campana=${c.id}`}>
                  <span><b>{col?.nombre}</b><small>{c.nombre}</small></span>
                  <span className={`badge ${listos ? "b-good" : "b-neutral"}`}>{listos} {listos === 1 ? "listo" : "listos"}</span>
                </Link>
              );
            })}
          </div>
        </div>
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
