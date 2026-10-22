import Link from "next/link";
import { notFound } from "next/navigation";
import { PERMISOS, requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { S } from "@/lib/formato";
import { crearPedido } from "../../actions";

export default async function NuevoPedido({
  searchParams,
}: {
  searchParams: Promise<{ alumno?: string; error?: string }>;
}) {
  const { alumno: alumnoId, error } = await searchParams;
  const { supabase } = await requirePerfil(PERMISOS.pedidos);
  if (!alumnoId) notFound();

  const [{ data: alumno }, { data: productos }] = await Promise.all([
    supabase.from("alumnos").select("id, nombres, apellidos, grado, seccion, campana_id, campanas(nombre)").eq("id", alumnoId).single(),
    supabase.from("productos").select("id, nombre, descripcion, precio, es_combo").eq("activo", true).order("es_combo", { ascending: false }).order("precio"),
  ]);
  if (!alumno) notFound();
  const campana = alumno.campanas as unknown as { nombre: string };
  const nombre = `${alumno.apellidos}, ${alumno.nombres}`;

  return (
    <section>
      <Link className="back" href={`/panel/campanas/${alumno.campana_id}`}>← {campana.nombre}</Link>
      <h1>Nuevo pedido</h1>
      <p className="lead">{nombre} · {[alumno.grado, alumno.seccion].filter(Boolean).join(" ")}</p>
      <Aviso error={error} />

      <form action={crearPedido} className="card stack">
        <input type="hidden" name="alumno_id" value={alumno.id} />
        <input type="hidden" name="campana_id" value={alumno.campana_id} />
        <input type="hidden" name="alumno_nombre" value={alumno.apellidos} />
        <h2>¿Qué lleva?</h2>
        {(productos ?? []).length === 0 && (
          <p className="empty">No hay productos en el catálogo. El dueño debe agregarlos en <Link href="/panel/catalogo">Catálogo</Link>.</p>
        )}
        {(productos ?? []).map((p) => (
          <div className="row" key={p.id}>
            <div className="grow">
              <b>{p.nombre}</b> {p.es_combo && <span className="pill p-info">Combo</span>}
              {p.descripcion && <div className="sub">{p.descripcion}</div>}
            </div>
            <span className="money">{S(p.precio)}</span>
            <label className="f">
              <span className="hint">Cantidad</span>
              <input name={`cant_${p.id}`} type="number" min={0} max={20} defaultValue={0} style={{ width: 90 }} />
            </label>
          </div>
        ))}
        <label className="f">Notas<input name="notas" placeholder="Ej.: entregar al tío" /></label>
        <div><button className="btn" type="submit">Crear pedido</button></div>
      </form>
    </section>
  );
}
