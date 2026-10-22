import Link from "next/link";
import { requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { crearColegio } from "../actions";

export default async function Colegios({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const aviso = await searchParams;
  const { supabase } = await requirePerfil();
  const { data: colegios } = await supabase
    .from("colegios")
    .select("id, codigo, nombre, ciudad, campanas(id, estado)")
    .order("nombre");

  return (
    <section>
      <h1>Colegios y alumnos</h1>
      <p className="lead">Cada colegio con sus campañas. La lista de alumnos se sube una vez y cada alumno recibe su código.</p>
      <Aviso {...aviso} />

      <details className="add card">
        <summary className="btn">+ Nuevo colegio</summary>
        <form action={crearColegio} className="stack">
          <div className="fields">
            <label className="f">Nombre<input name="nombre" required placeholder="I.E. San Martín de Porres" /></label>
            <label className="f">
              Código corto
              <input name="codigo" required maxLength={12} placeholder="SMP" />
              <span className="hint">Va en el nombre de cada foto. Sin espacios.</span>
            </label>
            <label className="f">Ciudad<input name="ciudad" defaultValue="Nauta" /></label>
            <label className="f">Director(a)<input name="director" /></label>
            <label className="f">Contacto (comité / APAFA)<input name="contacto_nombre" /></label>
            <label className="f">Teléfono del contacto<input name="contacto_telefono" type="tel" /></label>
          </div>
          <div><button className="btn" type="submit">Guardar colegio</button></div>
        </form>
      </details>

      <div className="card">
        {(colegios ?? []).length === 0 && <p className="empty">Aún no hay colegios. Agrega el primero con el botón de arriba.</p>}
        {(colegios ?? []).map((c) => {
          const abiertas = (c.campanas ?? []).filter((x) => x.estado !== "cerrada").length;
          return (
            <div className="row" key={c.id}>
              <Link className="grow" href={`/panel/colegios/${c.id}`}>
                <b>{c.nombre}</b>
                <div className="sub">{c.ciudad} · código {c.codigo}</div>
              </Link>
              <span className={`pill ${abiertas ? "p-info" : "p-warn"}`}>
                {abiertas ? `${abiertas} campaña${abiertas > 1 ? "s" : ""} abierta${abiertas > 1 ? "s" : ""}` : "Sin campaña abierta"}
              </span>
              <Link className="btn small ghost" href={`/panel/colegios/${c.id}`}>Abrir</Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
