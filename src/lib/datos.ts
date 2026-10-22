import type { SupabaseClient } from "@supabase/supabase-js";

// Supabase devuelve como máximo 1000 filas por consulta: pide de a páginas hasta traer todo.
export async function todas<T>(pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null }>, tam = 1000) {
  const filas: T[] = [];
  for (let desde = 0; ; desde += tam) {
    const { data } = await pagina(desde, desde + tam - 1);
    filas.push(...(data ?? []));
    if (!data || data.length < tam) return filas;
  }
}

export type AlumnoFila = {
  id: string; codigo: string; nombres: string; apellidos: string; grado: string | null; seccion: string | null;
  dni: string | null; apoderado: string | null; telefono: string | null; creado: string;
  campanaId: string; campana: string; anio: number; tipo: string; colegioId: string; colegio: string;
  pedidos: number; estado: string | null; total: number; pagado: number; saldo: number;
};

type Fila = {
  id: string; codigo: string; nombres: string; apellidos: string; grado: string | null; seccion: string | null; dni: string | null;
  apoderado_nombre: string | null; apoderado_telefono: string | null; creado_en: string; campana_id: string;
  campanas: { nombre: string; anio: number; tipo: string; colegios: { id: string; nombre: string } | null } | null;
};
type Saldo = { alumno_id: string; estado: string; total: number; pagado: number; saldo: number; numero: number };

// Todos los alumnos con su colegio, campaña y lo que compraron (sin contar pedidos anulados).
export async function alumnosConPedidos(supabase: SupabaseClient): Promise<AlumnoFila[]> {
  const [alumnos, saldos] = await Promise.all([
    todas<Fila>((a, b) =>
      supabase
        .from("alumnos")
        .select("id, codigo, nombres, apellidos, grado, seccion, dni, apoderado_nombre, apoderado_telefono, creado_en, campana_id, campanas(nombre, anio, tipo, colegios(id, nombre))")
        .order("id")
        .range(a, b)
        .returns<Fila[]>(),
    ),
    todas<Saldo>((a, b) =>
      supabase.from("pedidos_saldo").select("alumno_id, estado, total, pagado, saldo, numero").neq("estado", "anulado").order("numero").range(a, b).returns<Saldo[]>(),
    ),
  ]);
  const porAlumno = new Map<string, Saldo[]>();
  for (const s of saldos) porAlumno.set(s.alumno_id, [...(porAlumno.get(s.alumno_id) ?? []), s]);

  return alumnos.map((a) => {
    const ps = porAlumno.get(a.id) ?? [];
    const c = a.campanas;
    return {
      id: a.id, codigo: a.codigo, nombres: a.nombres, apellidos: a.apellidos, grado: a.grado, seccion: a.seccion, dni: a.dni,
      apoderado: a.apoderado_nombre, telefono: a.apoderado_telefono, creado: a.creado_en,
      campanaId: a.campana_id, campana: c?.nombre ?? "", anio: c?.anio ?? 0, tipo: c?.tipo ?? "",
      colegioId: c?.colegios?.id ?? "", colegio: c?.colegios?.nombre ?? "",
      pedidos: ps.length,
      estado: ps.at(-1)?.estado ?? null,
      total: ps.reduce((s, p) => s + Number(p.total), 0),
      pagado: ps.reduce((s, p) => s + Number(p.pagado), 0),
      saldo: ps.reduce((s, p) => s + Number(p.saldo), 0),
    };
  });
}

export const salon = (a: { grado: string | null; seccion: string | null }) =>
  a.grado || a.seccion ? `${a.grado ?? ""}${a.grado && !/[º°]/.test(a.grado) ? ".º" : ""} ${a.seccion ?? ""}`.trim() : "Sin salón";
