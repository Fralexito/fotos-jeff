import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { PERMISOS, requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Avatar, Empty, PageHeader } from "@/components/ui";
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
    supabase.from("alumnos").select("id, nombres, apellidos, grado, seccion, codigo, campana_id, campanas(nombre)").eq("id", alumnoId).single(),
    supabase.from("productos").select("id, nombre, descripcion, precio, es_combo").eq("activo", true).order("es_combo", { ascending: false }).order("precio"),
  ]);
  if (!alumno) notFound();
  const campana = alumno.campanas as unknown as { nombre: string };

  return (
    <>
      <PageHeader
        crumbs={[{ href: `/panel/campanas/${alumno.campana_id}`, label: campana.nombre }]}
        title="Nuevo pedido"
      />
      <Aviso error={error} />

      <div className="card">
        <div className="card-body">
          <div className="person">
            <Avatar name={`${alumno.nombres} ${alumno.apellidos}`} />
            <span>
              <b>{alumno.apellidos}, {alumno.nombres}</b>
              <small>{[alumno.grado && `${alumno.grado}.º`, alumno.seccion].filter(Boolean).join(" ")} · código {alumno.codigo}</small>
            </span>
          </div>
        </div>
      </div>

      <form action={crearPedido} className="card">
        <input type="hidden" name="alumno_id" value={alumno.id} />
        <input type="hidden" name="campana_id" value={alumno.campana_id} />
        <input type="hidden" name="alumno_nombre" value={alumno.apellidos} />
        <div className="card-head">
          <div><h2>Productos</h2><p>Indica cuántos lleva de cada uno</p></div>
        </div>
        {(productos ?? []).length === 0 ? (
          <Empty icon={Package} title="El catálogo está vacío">
            El dueño debe agregar productos en <Link href="/panel/catalogo">Catálogo</Link>.
          </Empty>
        ) : (
          <div className="list">
            {(productos ?? []).map((p) => (
              <label className="item" key={p.id} style={{ cursor: "pointer" }}>
                <div className="main">
                  <span className="avatar sq c0"><Package className="i" /></span>
                  <div>
                    <div className="title">{p.nombre} {p.es_combo && <span className="badge b-info">Combo</span>}</div>
                    {p.descripcion && <div className="meta">{p.descripcion}</div>}
                  </div>
                </div>
                <div className="end">
                  <span className="money">{S(p.precio)}</span>
                  <input className="qty" name={`cant_${p.id}`} type="number" min={0} max={20} defaultValue={0} aria-label={`Cantidad de ${p.nombre}`} />
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="card-body" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="form">
            <label className="field">Notas<input name="notas" placeholder="Ej.: entregar al tío" /></label>
            <div className="form-foot">
              <Link className="btn secondary" href={`/panel/campanas/${alumno.campana_id}`}>Cancelar</Link>
              <button className="btn" type="submit">Crear pedido</button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
