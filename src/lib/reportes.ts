import type { SupabaseClient } from "@supabase/supabase-js";

export type Deudor = {
  id: string; alumnoId: string; numero: number; saldo: number; total: number; pagado: number; estado: string;
  alumno: string; telefono: string | null; salon: string; colegio: string; campana: string;
};

// Pedidos con saldo pendiente, con los datos del alumno y del colegio, de mayor a menor deuda.
export async function deudores(supabase: SupabaseClient, sede: string | null = null): Promise<Deudor[]> {
  let q = supabase
    .from("pedidos_saldo")
    .select("id, alumno_id, numero, total, pagado, saldo, estado")
    .neq("estado", "anulado")
    .gt("saldo", 0)
    .order("saldo", { ascending: false })
    .limit(1000);
  if (sede) q = q.eq("sede", sede);
  const { data: saldos } = await q;
  const ids = (saldos ?? []).map((s) => s.id);
  if (ids.length === 0) return [];
  const datos = new Map<string, { alumno: string; telefono: string | null; salon: string; colegio: string; campana: string }>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase
      .from("pedidos")
      .select("id, alumnos(nombres, apellidos, grado, seccion, apoderado_telefono), campanas(nombre, colegios(nombre))")
      .in("id", ids.slice(i, i + 150));
    for (const p of data ?? []) {
      const a = p.alumnos as unknown as { nombres: string; apellidos: string; grado: string | null; seccion: string | null; apoderado_telefono: string | null } | null;
      const c = p.campanas as unknown as { nombre: string; colegios: { nombre: string } | null } | null;
      datos.set(p.id, {
        alumno: a ? `${a.apellidos}, ${a.nombres}` : "",
        telefono: a?.apoderado_telefono ?? null,
        salon: [a?.grado, a?.seccion].filter(Boolean).join(" "),
        colegio: c?.colegios?.nombre ?? "",
        campana: c?.nombre ?? "",
      });
    }
  }
  return (saldos ?? []).map((s) => ({
    id: s.id, alumnoId: s.alumno_id, numero: s.numero, estado: s.estado,
    saldo: Number(s.saldo), total: Number(s.total), pagado: Number(s.pagado),
    ...(datos.get(s.id) ?? { alumno: "", telefono: null, salon: "", colegio: "", campana: "" }),
  }));
}
