import { Package, Plus } from "lucide-react";
import { PERMISOS, requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Empty, PageHeader } from "@/components/ui";
import { CATEGORIAS, NIVELES, S } from "@/lib/formato";
import { CambiarCategoria } from "./nivel";
import { alternarProducto, crearProducto } from "../actions";
import { SimpleLista, SimpleTitulo } from "@/components/simple";

export default async function Catalogo({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; nuevo?: string }> }) {
  const { nuevo, ...aviso } = await searchParams;
  const { supabase, perfil } = await requirePerfil(PERMISOS.catalogo);
  const { data: productos } = await supabase.from("productos").select("*").order("activo", { ascending: false }).order("precio");
  // Una sección por categoría; las promociones además se dividen por nivel.
  type Prod = { id: string; codigo: string; nombre: string; descripcion: string | null; precio: number; es_combo: boolean; activo: boolean; categoria: string; nivel: string | null };
  const todos = (productos ?? []) as Prod[];
  const secciones = CATEGORIAS.map(([cat, titulo]) => {
    const lista = todos.filter((p) => (p.categoria ?? "otro") === cat);
    const grupos =
      cat === "promocion"
        ? [...NIVELES, ["", "Todos los niveles"]].map(([n, t]) => [t, lista.filter((p) => (p.nivel ?? "") === n)] as const).filter(([, l]) => l.length > 0)
        : [["", lista] as const];
    return { cat, titulo, total: lista.length, grupos };
  });

  // Vista sencilla: la lista de precios, como un menú.
  if (perfil.preferencias.vista === "sencilla") {
    return (
      <div className="simple">
        <SimpleTitulo titulo="Precios" sub="Lo que se vende" />
        <Aviso {...aviso} />
        {secciones.filter((x) => x.grupos.some(([, l]) => l.some((p) => p.activo))).map((x) => (
          <section key={x.cat} className="simple-dia">
            <h2 className="simple-sub">{x.titulo}</h2>
            <SimpleLista
              vacio=""
              filas={x.grupos.flatMap(([nivel, l]) => l).filter((p) => p.activo).map((p) => ({
                key: p.id, titulo: p.nombre, sub: [x.grupos.find(([, l]) => l.includes(p))?.[0], p.descripcion].filter(Boolean).join(" · ") || undefined,
                valor: S(p.precio), tono: "bien" as const,
              }))}
            />
          </section>
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        modulo="catalogo"
        title="Catálogo"
        subtitle="Promociones (por nivel), graduaciones, carnets y otros."
        actions={
          <Modal abrir={nuevo === "1"} label="Nuevo producto" title="Nuevo producto o combo" icon={<Plus className="i" />}>
            <form action={crearProducto} className="form">
              <div className="fields">
                <label className="field">Nombre<input name="nombre" required placeholder="Cuadro 20×30 con marco" /></label>
                <label className="field">
                  Código
                  <input name="codigo" required placeholder="20x30" />
                  <span className="hint">Corto y sin espacios.</span>
                </label>
                <label className="field">Precio (S/)<input name="precio" inputMode="decimal" required placeholder="80.00" /></label>
                <label className="field">Descripción<input name="descripcion" placeholder="Marco de madera y vidrio" /></label>
                <label className="field">
                  Categoría
                  <select name="categoria" defaultValue="promocion">
                    {CATEGORIAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
                <label className="field">
                  Nivel (solo promociones)
                  <select name="nivel" defaultValue="">
                    <option value="">Todos los niveles</option>
                    {NIVELES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
              </div>
              <label className="check"><input type="checkbox" name="es_combo" /> Es un combo (varios productos juntos)</label>
              <div className="form-foot"><button className="btn" type="submit">Guardar producto</button></div>
            </form>
          </Modal>
        }
      />
      <Aviso {...aviso} />

      {(productos ?? []).length === 0 ? (
        <div className="card"><Empty icon={Package} title="El catálogo está vacío">Agrega tus cuadros, carnets y combos con “Nuevo producto”.</Empty></div>
      ) : (
        secciones.map(({ cat, titulo, total, grupos }) => (
          <section key={cat} className="card nivel-card" data-cat={cat}>
            <div className="card-head">
              <h2><span className="nivel-punto" aria-hidden />{titulo}</h2>
              <span className="badge b-neutral">{total} {total === 1 ? "producto" : "productos"}</span>
            </div>
            {total === 0 ? (
              <p className="muted-text nivel-vacio">Aún no hay {titulo.toLowerCase()}.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Producto</th><th>Código</th><th>{cat === "promocion" ? "Categoría y nivel" : "Categoría"}</th><th className="num">Precio</th><th>Estado</th><th /></tr>
                  </thead>
                  {grupos.map(([sub, lista]) => (
                    <tbody key={sub || "todo"}>
                      {sub && <tr className="subgrupo"><td colSpan={6}>{sub}</td></tr>}
                      {lista.map((p) => (
                        <tr key={p.id} style={p.activo ? undefined : { opacity: 0.6 }}>
                          <td>
                            <div className="person">
                              <span className="avatar sq c0"><Package className="i" /></span>
                              <span>
                                <b>{p.nombre} {p.es_combo && <span className="badge b-info">Combo</span>}</b>
                                {p.descripcion && <small>{p.descripcion}</small>}
                              </span>
                            </div>
                          </td>
                          <td><span className="code">{p.codigo}</span></td>
                          <td><CambiarCategoria id={p.id} categoria={p.categoria ?? "otro"} nivel={p.nivel} /></td>
                          <td className="num money">{S(p.precio)}</td>
                          <td><span className={`badge ${p.activo ? "b-good" : "b-neutral"}`}>{p.activo ? "A la venta" : "Oculto"}</span></td>
                          <td className="num">
                            <form action={alternarProducto}>
                              <input type="hidden" name="id" value={p.id} />
                              <input type="hidden" name="activo" value={String(!p.activo)} />
                              <button className="btn secondary sm">{p.activo ? "Ocultar" : "Volver a vender"}</button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            )}
          </section>
        ))
      )}
    </>
  );
}
