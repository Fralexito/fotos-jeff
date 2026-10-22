import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardPaste, ShoppingBag, UserPlus, Users } from "lucide-react";
import { requirePerfil, puede } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Avatar, Empty, PageHeader } from "@/components/ui";
import { TIPO_CAMPANA } from "@/lib/formato";
import { SimpleLista, SimpleTitulo } from "@/components/simple";
import { agregarAlumno, importarAlumnos } from "../../actions";

type Alumno = {
  id: string; codigo: string; nombres: string; apellidos: string;
  grado: string | null; seccion: string | null; apoderado_nombre: string | null; apoderado_telefono: string | null;
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
      .select("id, codigo, nombres, apellidos, grado, seccion, apoderado_nombre, apoderado_telefono")
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
    const k = a.grado || a.seccion ? `${a.grado ?? ""}.º ${a.seccion ?? ""}`.trim() : "Sin salón";
    salones.set(k, [...(salones.get(k) ?? []), a]);
  }
  const hacePedidos = puede(perfil, "pedidos");

  // Vista sencilla: salones con sus alumnos, cada uno lleva a su ficha.
  if (perfil.preferencias.vista === "sencilla") {
    return (
      <div className="simple">
        <SimpleTitulo titulo={campana.nombre} volver={{ href: `/panel/colegios/${colegio.id}`, texto: colegio.nombre }} sub={`${alumnos?.length ?? 0} alumnos`} />
        {salones.size === 0 && <p className="simple-vacio">Todavía no hay alumnos en esta lista.</p>}
        {[...salones].map(([salon, lista]) => (
          <section key={salon} className="simple">
            <h2 className="simple-sub">{salon} <small className="muted">· {lista.length}</small></h2>
            <SimpleLista vacio="" filas={lista.map((a) => ({ key: a.id, href: `/panel/alumnos/${a.id}`, titulo: `${a.apellidos}, ${a.nombres}`, sub: a.apoderado_nombre ?? undefined }))} />
          </section>
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/panel/colegios", label: "Colegios" },
          { href: `/panel/colegios/${colegio.id}`, label: colegio.nombre },
        ]}
        title={campana.nombre}
        subtitle={`${TIPO_CAMPANA[campana.tipo]} ${campana.anio} · ${alumnos?.length ?? 0} alumnos en ${salones.size} ${salones.size === 1 ? "salón" : "salones"}`}
        actions={
          <>
            <Modal label="Un alumno" title="Agregar alumno" variant="secondary" icon={<UserPlus className="i" />}>
              <form action={agregarAlumno} className="form">
                <input type="hidden" name="campana_id" value={campana.id} />
                <div className="fields">
                  <label className="field">Apellidos<input name="apellidos" required /></label>
                  <label className="field">Nombres<input name="nombres" required /></label>
                  <label className="field">Grado<input name="grado" placeholder="5" /></label>
                  <label className="field">Sección<input name="seccion" placeholder="B" maxLength={3} /></label>
                  <label className="field">DNI<input name="dni" inputMode="numeric" maxLength={8} /></label>
                  <label className="field">Apoderado<input name="apoderado_nombre" /></label>
                  <label className="field">Teléfono del apoderado<input name="apoderado_telefono" type="tel" /></label>
                </div>
                <div className="form-foot"><button className="btn" type="submit">Guardar alumno</button></div>
              </form>
            </Modal>
            <Modal label="Pegar lista" title="Pegar lista de alumnos" icon={<ClipboardPaste className="i" />}>
              <form action={importarAlumnos} className="form">
                <input type="hidden" name="campana_id" value={campana.id} />
                <label className="field">
                  Lista desde Excel
                  <span className="hint">
                    Copia las filas en Excel y pégalas aquí. Columnas: Apellidos, Nombres, Grado, Sección, DNI, Apoderado,
                    Teléfono. Solo apellidos y nombres son obligatorios.
                  </span>
                  <textarea name="lista" required placeholder={"Ruiz Tapullima\tAna Lucía\t5\tB\t71234567\tRosa Tapullima\t987654321"} />
                </label>
                <div className="form-foot"><button className="btn" type="submit">Agregar a la lista</button></div>
              </form>
            </Modal>
          </>
        }
      />
      <Aviso {...aviso} />

      {salones.size === 0 && (
        <div className="card">
          <Empty icon={Users} title="Todavía no hay alumnos">Usa “Pegar lista” para cargar la lista del colegio desde Excel.</Empty>
        </div>
      )}
      {[...salones].map(([salon, lista]) => (
        <div className="card" key={salon}>
          <div className="card-head">
            <h2>{salon}</h2>
            <span className="badge b-neutral">{lista.length} {lista.length === 1 ? "alumno" : "alumnos"}</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Alumno</th><th>Código</th><th>Apoderado</th>{hacePedidos && <th />}</tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="person">
                        <Avatar name={`${a.nombres} ${a.apellidos}`} />
                        <span><b>{a.apellidos}</b><small>{a.nombres}</small></span>
                      </div>
                    </td>
                    <td><span className="code">{a.codigo}</span></td>
                    <td>
                      {a.apoderado_nombre ?? ""}
                      {a.apoderado_telefono ? <div className="meta" style={{ color: "var(--muted)", fontSize: 13 }}>{a.apoderado_telefono}</div> : !a.apoderado_nombre && "—"}
                    </td>
                    {hacePedidos && (
                      <td className="num">
                        <Link className="btn secondary sm" href={`/panel/pedidos/nuevo?alumno=${a.id}`}>
                          <ShoppingBag className="i" /> Nuevo pedido
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
