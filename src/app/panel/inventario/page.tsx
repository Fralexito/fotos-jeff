import { Boxes, PackageMinus, PackagePlus, Plus, TriangleAlert } from "lucide-react";
import { puede, requirePerfil } from "@/lib/auth";
import { S } from "@/lib/formato";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Empty, PageHeader } from "@/components/ui";
import { crearMaterial, moverInventario } from "../acciones-erp";

const CATEGORIAS = ["Papel", "Marcos", "Tinta", "Empaque", "Carnets", "Otros"];
const MOTIVO: Record<string, string> = { compra: "Compra", uso: "Uso", ajuste: "Ajuste" };

type Material = { id: string; nombre: string; categoria: string; unidad: string; stock: number; minimo: number; costo_unitario: number | null };

const cant = (n: number) => Number(n).toLocaleString("es-PE", { maximumFractionDigits: 2 });

export default async function Inventario({ searchParams }: { searchParams: Promise<{ nuevo?: string; ok?: string; error?: string }> }) {
  const { nuevo, ...aviso } = await searchParams;
  const { supabase, perfil } = await requirePerfil();
  const [{ data }, { data: movs }] = await Promise.all([
    supabase.from("materiales").select("id, nombre, categoria, unidad, stock, minimo, costo_unitario").eq("activo", true).order("categoria").order("nombre").returns<Material[]>(),
    supabase.from("movimientos_inventario").select("id, motivo, cantidad, nota, creado_en, materiales(nombre, unidad), perfiles(nombre)").order("creado_en", { ascending: false }).limit(12),
  ]);
  const materiales = data ?? [];
  const bajos = materiales.filter((m) => Number(m.stock) <= Number(m.minimo));
  const valor = materiales.reduce((s, m) => s + Math.max(0, Number(m.stock)) * Number(m.costo_unitario ?? 0), 0);
  const conCaja = puede(perfil, "caja");

  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle="Papel, marcos, tinta y todo lo que se usa para entregar los pedidos."
        actions={
          <Modal abrir={nuevo === "1"} label="Nuevo material" title="Nuevo material" icon={<Plus className="i" />}>
            <form action={crearMaterial} className="form">
              <div className="fields">
                <label className="field" style={{ gridColumn: "1 / -1" }}>Nombre<input name="nombre" required placeholder="Papel fotográfico 20×30 lustre" /></label>
                <label className="field">Categoría<select name="categoria">{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="field">Unidad<input name="unidad" defaultValue="unid." placeholder="hojas, cajas, ml…" /></label>
                <label className="field">Cantidad que hay ahora<input name="stock" inputMode="decimal" placeholder="0" /></label>
                <label className="field">Avisar cuando queden<input name="minimo" inputMode="decimal" placeholder="20" /></label>
                <label className="field">Costo por unidad (S/)<input name="costo_unitario" inputMode="decimal" placeholder="0.00" /></label>
              </div>
              <div className="form-foot"><button className="btn" type="submit">Guardar material</button></div>
            </form>
          </Modal>
        }
      />
      <Aviso {...aviso} />

      {bajos.length > 0 && (
        <div className="notice warn">
          <TriangleAlert className="i" />
          <span><b>Comprar pronto:</b> {bajos.map((m) => `${m.nombre} (quedan ${cant(m.stock)} ${m.unidad})`).join(" · ")}</span>
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><div className="top">Materiales <span className="ico"><Boxes className="i" /></span></div><div className="val">{materiales.length}</div><div className="sub">en uso</div></div>
        <div className={`kpi${bajos.length ? " alert" : ""}`}><div className="top">Por agotarse <span className={`ico ${bajos.length ? "bad" : ""}`}><TriangleAlert className="i" /></span></div><div className="val">{bajos.length}</div><div className="sub">en o bajo el mínimo</div></div>
        <div className="kpi"><div className="top">Valor en almacén <span className="ico info"><PackagePlus className="i" /></span></div><div className="val">{S(valor)}</div><div className="sub">según costo por unidad</div></div>
      </div>

      <div className="card">
        {materiales.length === 0 ? (
          <Empty icon={Boxes} title="Aún no hay materiales">Agrega el papel, los marcos y la tinta que usas para saber cuándo comprar.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Material</th><th>Stock</th><th style={{ minWidth: 380 }}>Registrar</th></tr></thead>
              <tbody>
                {materiales.map((m) => {
                  const stock = Number(m.stock), min = Number(m.minimo);
                  const nivel = stock <= 0 ? "b-bad" : stock <= min ? "b-warn" : "b-good";
                  const pct = Math.min(100, min > 0 ? (stock / (min * 3)) * 100 : stock > 0 ? 100 : 0);
                  return (
                    <tr key={m.id}>
                      <td><b>{m.nombre}</b><br /><small className="muted">{m.categoria}{m.costo_unitario ? ` · ${S(m.costo_unitario)} c/u` : ""}</small></td>
                      <td style={{ minWidth: 170 }}>
                        <div className="stock">
                          <span className="money">{cant(stock)} <small className="muted">{m.unidad}</small></span>
                          <span className={`badge ${nivel}`}>{stock <= 0 ? "Agotado" : stock <= min ? "Bajo" : "Bien"}</span>
                        </div>
                        <div className={`progress ${nivel}`}><span style={{ width: `${pct}%` }} /></div>
                        {min > 0 && <small className="muted">mínimo {cant(min)}</small>}
                      </td>
                      <td>
                        <form action={moverInventario} className="inline-form">
                          <input type="hidden" name="material_id" value={m.id} />
                          <input className="input" name="cantidad" inputMode="decimal" placeholder="Cant." required style={{ width: 80 }} />
                          {conCaja && <input className="input" name="costo" inputMode="decimal" placeholder="Pagado S/" title="Si es compra, se anota como gasto en Caja" style={{ width: 104 }} />}
                          <div className="seg">
                            <button name="motivo" value="compra" title="Entró por compra"><PackagePlus className="i" /> Compra</button>
                            <button name="motivo" value="uso" title="Se usó"><PackageMinus className="i" /> Uso</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(movs ?? []).length > 0 && (
        <div className="card">
          <div className="card-head"><h2>Últimos movimientos</h2></div>
          <div className="list">
            {(movs ?? []).map((x) => {
              const mat = x.materiales as unknown as { nombre: string; unidad: string } | null;
              return (
                <div className="item" key={x.id}>
                  <div className="main">
                    <div>
                      <div className="title">{mat?.nombre}</div>
                      <div className="meta">{MOTIVO[x.motivo]}{x.nota && ` · ${x.nota}`} · {(x.perfiles as unknown as { nombre: string } | null)?.nombre ?? ""} · {new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Lima" }).format(new Date(x.creado_en))}</div>
                    </div>
                  </div>
                  <div className="end"><span className={`money ${Number(x.cantidad) < 0 ? "neg" : "pos"}`}>{Number(x.cantidad) > 0 ? "+" : "−"}{cant(Math.abs(Number(x.cantidad)))} {mat?.unidad}</span></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
