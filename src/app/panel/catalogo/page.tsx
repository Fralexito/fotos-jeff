import { PERMISOS, requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { S } from "@/lib/formato";
import { alternarProducto, crearProducto } from "../actions";

export default async function Catalogo({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const aviso = await searchParams;
  const { supabase } = await requirePerfil(PERMISOS.catalogo);
  const { data: productos } = await supabase.from("productos").select("*").order("activo", { ascending: false }).order("precio");

  return (
    <section>
      <h1>Catálogo</h1>
      <p className="lead">Los productos y combos que se venden. Lo que esté activo aparece al crear pedidos y en la página web.</p>
      <Aviso {...aviso} />

      <details className="add card">
        <summary className="btn">+ Nuevo producto o combo</summary>
        <form action={crearProducto} className="stack">
          <div className="fields">
            <label className="f">Nombre<input name="nombre" required placeholder="Cuadro 20×30 con marco" /></label>
            <label className="f">
              Código
              <input name="codigo" required placeholder="20x30" />
              <span className="hint">Corto y sin espacios.</span>
            </label>
            <label className="f">Precio (S/)<input name="precio" inputMode="decimal" required placeholder="80.00" /></label>
            <label className="f">Descripción<input name="descripcion" placeholder="Marco de madera y vidrio" /></label>
          </div>
          <label><input type="checkbox" name="es_combo" /> Es un combo (varios productos juntos)</label>
          <div><button className="btn" type="submit">Guardar producto</button></div>
        </form>
      </details>

      <div className="card">
        {(productos ?? []).length === 0 && <p className="empty">El catálogo está vacío.</p>}
        {(productos ?? []).map((p) => (
          <div className="row" key={p.id}>
            <div className="grow">
              <b>{p.nombre}</b> {p.es_combo && <span className="pill p-info">Combo</span>}
              <div className="sub">{p.codigo}{p.descripcion && ` · ${p.descripcion}`}</div>
            </div>
            <span className="money">{S(p.precio)}</span>
            <span className={`pill ${p.activo ? "p-good" : "p-warn"}`}>{p.activo ? "A la venta" : "Oculto"}</span>
            <form action={alternarProducto}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="activo" value={String(!p.activo)} />
              <button className="btn small ghost">{p.activo ? "Ocultar" : "Volver a vender"}</button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
