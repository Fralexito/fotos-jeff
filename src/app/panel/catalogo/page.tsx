import { Package, Plus } from "lucide-react";
import { PERMISOS, requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Empty, PageHeader } from "@/components/ui";
import { S } from "@/lib/formato";
import { alternarProducto, crearProducto } from "../actions";

export default async function Catalogo({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const aviso = await searchParams;
  const { supabase } = await requirePerfil(PERMISOS.catalogo);
  const { data: productos } = await supabase.from("productos").select("*").order("activo", { ascending: false }).order("precio");

  return (
    <>
      <PageHeader
        title="Catálogo"
        subtitle="Productos y combos a la venta. Lo activo aparece al crear pedidos y en la página web."
        actions={
          <Modal label="Nuevo producto" title="Nuevo producto o combo" icon={<Plus className="i" />}>
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
              </div>
              <label className="check"><input type="checkbox" name="es_combo" /> Es un combo (varios productos juntos)</label>
              <div className="form-foot"><button className="btn" type="submit">Guardar producto</button></div>
            </form>
          </Modal>
        }
      />
      <Aviso {...aviso} />

      <div className="card">
        {(productos ?? []).length === 0 ? (
          <Empty icon={Package} title="El catálogo está vacío">Agrega tus cuadros, carnets y combos con “Nuevo producto”.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Producto</th><th>Código</th><th className="num">Precio</th><th>Estado</th><th /></tr>
              </thead>
              <tbody>
                {(productos ?? []).map((p) => (
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
            </table>
          </div>
        )}
      </div>
    </>
  );
}
