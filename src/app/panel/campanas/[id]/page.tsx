import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerfil, puede } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { TIPO_CAMPANA } from "@/lib/formato";
import { agregarAlumno, importarAlumnos } from "../../actions";

type Alumno = {
  id: string; codigo: string; nombres: string; apellidos: string;
  grado: string | null; seccion: string | null; apoderado_telefono: string | null;
};

export default async function Campana({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [{ id }, aviso] = await Promise.all([params, searchParams]);
  const { supabase, perfil } = await requirePerfil();

  const [{ data: campana }, { data: alumnos }] = await Promise.all([
    supabase.from("campanas").select("id, nombre, tipo, anio, colegios(id, nombre)").eq("id", id).single(),
    supabase
      .from("alumnos")
      .select("id, codigo, nombres, apellidos, grado, seccion, apoderado_telefono")
      .eq("campana_id", id)
      .order("grado")
      .order("seccion")
      .order("apellidos")
      .returns<Alumno[]>(),
  ]);
  if (!campana) notFound();
  const colegio = campana.colegios as unknown as { id: string; nombre: string };

  // Agrupar por salón (grado + sección) para que la lista se lea como la del tutor.
  const salones = new Map<string, Alumno[]>();
  for (const a of alumnos ?? []) {
    const k = [a.grado, a.seccion].filter(Boolean).join(" ") || "Sin salón";
    salones.set(k, [...(salones.get(k) ?? []), a]);
  }
  const hacePedidos = puede(perfil, "pedidos");

  return (
    <section>
      <Link className="back" href={`/panel/colegios/${colegio.id}`}>← {colegio.nombre}</Link>
      <h1>{campana.nombre}</h1>
      <p className="lead">
        {TIPO_CAMPANA[campana.tipo]} {campana.anio} · {alumnos?.length ?? 0} alumnos en {salones.size} salones
      </p>
      <Aviso {...aviso} />

      <div className="toolbar">
        <details className="add">
          <summary className="btn">Pegar lista de alumnos</summary>
          <form action={importarAlumnos} className="stack card">
            <input type="hidden" name="campana_id" value={campana.id} />
            <label className="f">
              Lista
              <span className="hint">
                Copia las filas desde Excel y pégalas aquí. Columnas en este orden: Apellidos, Nombres, Grado, Sección, DNI,
                Apoderado, Teléfono. Solo apellidos y nombres son obligatorios.
              </span>
              <textarea name="lista" required placeholder={"Ruiz Tapullima\tAna Lucía\t5\tB\t71234567\tRosa Tapullima\t987654321"} />
            </label>
            <div><button className="btn" type="submit">Agregar a la lista</button></div>
          </form>
        </details>
        <details className="add">
          <summary className="btn ghost">+ Un alumno</summary>
          <form action={agregarAlumno} className="stack card">
            <input type="hidden" name="campana_id" value={campana.id} />
            <div className="fields">
              <label className="f">Apellidos<input name="apellidos" required /></label>
              <label className="f">Nombres<input name="nombres" required /></label>
              <label className="f">Grado<input name="grado" placeholder="5" /></label>
              <label className="f">Sección<input name="seccion" placeholder="B" maxLength={3} /></label>
              <label className="f">DNI<input name="dni" inputMode="numeric" maxLength={8} /></label>
              <label className="f">Apoderado<input name="apoderado_nombre" /></label>
              <label className="f">Teléfono del apoderado<input name="apoderado_telefono" type="tel" /></label>
            </div>
            <div><button className="btn" type="submit">Guardar alumno</button></div>
          </form>
        </details>
      </div>

      {salones.size === 0 && (
        <div className="card"><p className="empty">Todavía no hay alumnos. Pega la lista del colegio para empezar.</p></div>
      )}
      {[...salones].map(([salon, lista]) => (
        <div className="card" key={salon}>
          <h2>{salon} · {lista.length} alumnos</h2>
          <table className="list">
            <thead>
              <tr><th>Alumno</th><th>Código</th><th>Apoderado</th>{hacePedidos && <th />}</tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.apellidos}</b>, {a.nombres}</td>
                  <td className="money">{a.codigo}</td>
                  <td>{a.apoderado_telefono ?? "—"}</td>
                  {hacePedidos && (
                    <td><Link className="btn small ghost" href={`/panel/pedidos/nuevo?alumno=${a.id}`}>Nuevo pedido</Link></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
