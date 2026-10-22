import type { SupabaseClient } from "@supabase/supabase-js";

export type Movimiento = {
  id: string; tipo: "ingreso" | "egreso"; categoria: string; concepto: string; monto: number; metodo: string; creado_en: string;
  perfiles: { nombre: string } | null;
};
export type PagoDia = {
  id: string; monto: number; metodo: string; creado_en: string;
  pedidos: { numero: number; alumnos: { nombres: string; apellidos: string } | null } | null;
};

// Todo lo que entró y salió en un día de Lima: pagos confirmados de pedidos + movimientos manuales.
// Cada sede tiene su propia caja.
export async function resumenCaja(supabase: SupabaseClient, fecha: string, sede: string) {
  const desde = `${fecha}T00:00:00-05:00`;
  const hasta = new Date(new Date(desde).getTime() + 86400000).toISOString();
  const [{ data: pagos }, { data: movs }, { data: cierre }] = await Promise.all([
    supabase
      .from("pagos")
      .select("id, monto, metodo, creado_en, pedidos!inner(numero, sede, alumnos(nombres, apellidos))")
      .eq("estado", "confirmado")
      .eq("pedidos.sede", sede)
      .gte("creado_en", desde)
      .lt("creado_en", hasta)
      .order("creado_en")
      .returns<PagoDia[]>(),
    supabase
      .from("movimientos_caja")
      .select("id, tipo, categoria, concepto, monto, metodo, creado_en, perfiles(nombre)")
      .eq("fecha", fecha)
      .eq("sede", sede)
      .order("creado_en")
      .returns<Movimiento[]>(),
    supabase.from("cierres_caja").select("*, perfiles(nombre)").eq("fecha", fecha).eq("sede", sede).maybeSingle(),
  ]);

  const p = pagos ?? [];
  const m = movs ?? [];
  const suma = (xs: { monto: number }[]) => xs.reduce((s, x) => s + Number(x.monto), 0);
  const ingresosPedidos = suma(p);
  const otrosIngresos = suma(m.filter((x) => x.tipo === "ingreso"));
  const egresos = suma(m.filter((x) => x.tipo === "egreso"));
  const efectivo =
    suma(p.filter((x) => x.metodo === "efectivo")) +
    suma(m.filter((x) => x.tipo === "ingreso" && x.metodo === "efectivo")) -
    suma(m.filter((x) => x.tipo === "egreso" && x.metodo === "efectivo"));
  const porMetodo = ["efectivo", "yape", "plin", "transferencia", "tarjeta"]
    .map((met) => ({ metodo: met, monto: suma(p.filter((x) => x.metodo === met)) }))
    .filter((x) => x.monto > 0);

  return {
    pagos: p, movimientos: m, cierre,
    ingresos: ingresosPedidos + otrosIngresos, ingresosPedidos, otrosIngresos, egresos,
    neto: ingresosPedidos + otrosIngresos - egresos, efectivo, porMetodo,
  };
}
