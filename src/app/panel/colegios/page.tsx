import Link from "next/link";
import { Plus, School, Sheet } from "lucide-react";
import { requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Empty, PageHeader } from "@/components/ui";
import { alumnosConPedidos } from "@/lib/datos";
import { NOMBRE_SEDE, SEDES, ZONAS, filtroSede } from "@/lib/sedes";
import { ArbolColegios, type ColegioArbol } from "./arbol";
import { crearColegio } from "../actions";

export default async function Colegios({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; nuevo?: string }> }) {
  const { nuevo, ...aviso } = await searchParams;
  const { supabase, perfil } = await requirePerfil();
  const sede = filtroSede(perfil.preferencias.sede);
  let consulta = supabase
    .from("colegios")
    .select("id, codigo, nombre, ciudad, director, sede, zona, campanas(id, nombre, anio, tipo, estado)")
    .order("nombre")
    .order("anio", { referencedTable: "campanas", ascending: false });
  if (sede) consulta = consulta.eq("sede", sede);
  const [{ data: colegios }, alumnos] = await Promise.all([consulta, alumnosConPedidos(supabase, sede)]);
  const anios = [...new Set((colegios ?? []).flatMap((c) => (c.campanas ?? []).map((k: { anio: number }) => k.anio)))].sort((a, b) => b - a);

  return (
    <>
      <PageHeader
        modulo="colegios"
        title="Colegios y alumnos"
        subtitle={sede ? `Sede ${NOMBRE_SEDE[sede]}. Toca un colegio para ver sus salones y alumnos.` : "Toca un colegio para ver sus salones y alumnos."}
        actions={
          <>
          <Link className="btn secondary" href="/panel/tabla"><Sheet className="i" /> Ver en tabla</Link>
          <Modal abrir={nuevo === "1"} label="Nuevo colegio" title="Nuevo colegio" icon={<Plus className="i" />}>
            <form action={crearColegio} className="form">
              <div className="fields">
                <label className="field">Nombre<input name="nombre" required placeholder="I.E. San Martín de Porres" /></label>
                <label className="field">
                  Código corto
                  <input name="codigo" required maxLength={12} placeholder="SMP" />
                  <span className="hint">Va en el nombre de cada foto. Sin espacios.</span>
                </label>
                <label className="field">
                  Sede que lo atiende
                  <select name="sede" defaultValue={sede ?? "nauta"}>
                    {SEDES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
                <label className="field">
                  Dónde queda
                  <select name="zona" defaultValue="ciudad">
                    {ZONAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
                <label className="field">
                  Ciudad o pueblo
                  <input name="ciudad" defaultValue={sede?.startsWith("iquitos") ? "Iquitos" : "Nauta"} />
                  <span className="hint">Ej.: Nauta, Iquitos, San Joaquín de Omaguas, km 50.</span>
                </label>
                <label className="field">Director(a)<input name="director" /></label>
                <label className="field">Contacto (comité / APAFA)<input name="contacto_nombre" /></label>
                <label className="field">Teléfono del contacto<input name="contacto_telefono" type="tel" /></label>
              </div>
              <div className="form-foot"><button className="btn" type="submit">Guardar colegio</button></div>
            </form>
          </Modal>
          </>
        }
      />
      <Aviso {...aviso} />

      {(colegios ?? []).length === 0 ? (
        <div className="card"><Empty icon={School} title="Aún no hay colegios">Agrega el primero con el botón “Nuevo colegio”.</Empty></div>
      ) : (
        <ArbolColegios
          colegios={(colegios ?? []) as ColegioArbol[]}
          anios={anios}
          alumnos={alumnos.map(({ id, codigo, nombres, apellidos, grado, seccion, apoderado, telefono, campanaId, colegioId, anio, pedidos, estado, saldo, total }) => ({
            id, codigo, nombres, apellidos, grado, seccion, apoderado, telefono, campanaId, colegioId, anio, pedidos, estado, saldo, total,
          }))}
        />
      )}
    </>
  );
}
