import Link from "next/link";
import { ChevronRight, Plus, School } from "lucide-react";
import { requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Avatar, Empty, PageHeader } from "@/components/ui";
import { crearColegio } from "../actions";

export default async function Colegios({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const aviso = await searchParams;
  const { supabase } = await requirePerfil();
  const { data: colegios } = await supabase
    .from("colegios")
    .select("id, codigo, nombre, ciudad, director, campanas(id, estado, alumnos(count))")
    .order("nombre");

  return (
    <>
      <PageHeader
        title="Colegios y alumnos"
        subtitle="Cada colegio con sus campañas. La lista de alumnos se sube una vez y cada alumno recibe su código."
        actions={
          <Modal label="Nuevo colegio" title="Nuevo colegio" icon={<Plus className="i" />}>
            <form action={crearColegio} className="form">
              <div className="fields">
                <label className="field">Nombre<input name="nombre" required placeholder="I.E. San Martín de Porres" /></label>
                <label className="field">
                  Código corto
                  <input name="codigo" required maxLength={12} placeholder="SMP" />
                  <span className="hint">Va en el nombre de cada foto. Sin espacios.</span>
                </label>
                <label className="field">Ciudad<input name="ciudad" defaultValue="Nauta" /></label>
                <label className="field">Director(a)<input name="director" /></label>
                <label className="field">Contacto (comité / APAFA)<input name="contacto_nombre" /></label>
                <label className="field">Teléfono del contacto<input name="contacto_telefono" type="tel" /></label>
              </div>
              <div className="form-foot"><button className="btn" type="submit">Guardar colegio</button></div>
            </form>
          </Modal>
        }
      />
      <Aviso {...aviso} />

      <div className="card">
        {(colegios ?? []).length === 0 ? (
          <Empty icon={School} title="Aún no hay colegios">Agrega el primero con el botón “Nuevo colegio”.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Colegio</th><th>Código</th><th className="num">Alumnos</th><th>Campañas</th><th /></tr>
              </thead>
              <tbody>
                {(colegios ?? []).map((c) => {
                  const campanas = (c.campanas ?? []) as { estado: string; alumnos: { count: number }[] }[];
                  const abiertas = campanas.filter((x) => x.estado !== "cerrada").length;
                  const alumnos = campanas.reduce((s, x) => s + (x.alumnos[0]?.count ?? 0), 0);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/panel/colegios/${c.id}`} className="person" style={{ textDecoration: "none" }}>
                          <Avatar name={c.nombre} square />
                          <span><b>{c.nombre}</b><small>{c.ciudad}{c.director && ` · ${c.director}`}</small></span>
                        </Link>
                      </td>
                      <td><span className="code">{c.codigo}</span></td>
                      <td className="num">{alumnos}</td>
                      <td>
                        {abiertas ? (
                          <span className="badge b-info">{abiertas} abierta{abiertas > 1 ? "s" : ""}</span>
                        ) : (
                          <span className="badge b-neutral">Sin campaña abierta</span>
                        )}
                      </td>
                      <td className="num">
                        <Link className="btn ghost sm" href={`/panel/colegios/${c.id}`}>
                          Abrir <ChevronRight className="i" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
