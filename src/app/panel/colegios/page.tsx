import Link from "next/link";
import { Plus, School, Sheet } from "lucide-react";
import { requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Empty, PageHeader } from "@/components/ui";
import { alumnosConPedidos } from "@/lib/datos";
import { ArbolColegios, type ColegioArbol } from "./arbol";
import { crearColegio } from "../actions";

export default async function Colegios({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; nuevo?: string }> }) {
  const { nuevo, ...aviso } = await searchParams;
  const { supabase } = await requirePerfil();
  const [{ data: colegios }, alumnos] = await Promise.all([
    supabase
      .from("colegios")
      .select("id, codigo, nombre, ciudad, director, campanas(id, nombre, anio, tipo, estado)")
      .order("nombre")
      .order("anio", { referencedTable: "campanas", ascending: false }),
    alumnosConPedidos(supabase),
  ]);
  const anios = [...new Set((colegios ?? []).flatMap((c) => (c.campanas ?? []).map((k: { anio: number }) => k.anio)))].sort((a, b) => b - a);

  return (
    <>
      <PageHeader
        modulo="colegios"
        title="Colegios y alumnos"
        subtitle="Toca un colegio para ver sus salones y alumnos."
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
                <label className="field">Ciudad<input name="ciudad" defaultValue="Nauta" /></label>
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
