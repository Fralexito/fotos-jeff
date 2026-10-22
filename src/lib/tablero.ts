import type { SupabaseClient } from "@supabase/supabase-js";
import { resumenCaja } from "@/lib/caja";
import { SEDES } from "@/lib/sedes";

const diaLima = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d);
const sumar = (xs: { monto: number }[]) => xs.reduce((s, x) => s + Number(x.monto), 0);

// Números del tablero de Inicio (vista completa). Con sede = null suma las tres sedes.
export async function tablero(supabase: SupabaseClient, sede: string | null, dias: number) {
  const hoy = diaLima(new Date());
  const mes = hoy.slice(0, 7);
  const mesIni = `${mes}-01`;
  const [y, m] = mes.split("-").map(Number);
  const mesAnt = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const serie = Array.from({ length: dias }, (_, i) => diaLima(new Date(Date.now() - (dias - 1 - i) * 86400000)));
  const desde = serie[0] < mesAnt ? serie[0] : mesAnt;

  let qPagos = supabase.from("pagos").select(sede ? "monto, metodo, creado_en, pedidos!inner(sede)" : "monto, metodo, creado_en").eq("estado", "confirmado").gte("creado_en", `${desde}T00:00:00-05:00`);
  let qMetas = supabase.from("metas").select("sede, monto").eq("mes", mesIni);
  let qSesiones = supabase.from("campanas").select(sede ? "id, fecha_captura, estado, colegios!inner(sede)" : "id, fecha_captura, estado").neq("estado", "cerrada");
  let qLab = supabase.from("pedidos").select("estado").in("estado", ["procesado", "en_impresion"]);
  let qDemanda = supabase.from("pedidos").select("campanas(tipo)").neq("estado", "anulado").gte("creado_en", new Date(Date.now() - 90 * 86400000).toISOString());
  let qSaldo = supabase.from("pedidos_saldo").select("saldo").neq("estado", "anulado").gt("saldo", 0);
  if (sede) {
    qPagos = qPagos.eq("pedidos.sede", sede);
    qMetas = qMetas.eq("sede", sede);
    qSesiones = qSesiones.eq("colegios.sede", sede);
    qLab = qLab.eq("sede", sede);
    qDemanda = qDemanda.eq("sede", sede);
    qSaldo = qSaldo.eq("sede", sede);
  }
  const sedesCaja = sede ? [sede] : SEDES.map(([id]) => id);
  const [{ data: pagos }, { data: metas }, { data: sesiones }, { data: lab }, { data: demanda }, { data: saldos }, cajas] = await Promise.all([
    qPagos.returns<{ monto: number; metodo: string; creado_en: string }[]>(),
    qMetas,
    qSesiones.returns<{ id: string; fecha_captura: string | null; estado: string }[]>(),
    qLab,
    qDemanda.returns<{ campanas: { tipo: string } | null }[]>(),
    qSaldo,
    Promise.all(sedesCaja.map((s) => resumenCaja(supabase, hoy, s))),
  ]);

  const ps = (pagos ?? []).map((p) => ({ ...p, dia: diaLima(new Date(p.creado_en)) }));
  const ingresosMes = sumar(ps.filter((p) => p.dia >= mesIni));
  const ingresosMesAnt = sumar(ps.filter((p) => p.dia >= mesAnt && p.dia < mesIni));
  const meta = sumar((metas ?? []) as { monto: number }[]);
  const porTipo = new Map<string, number>();
  for (const d of demanda ?? []) {
    const t = d.campanas?.tipo ?? "otro";
    porTipo.set(t, (porTipo.get(t) ?? 0) + 1);
  }

  return {
    hoy, mes, diasMes,
    ingresosMes, ingresosMesAnt,
    variacion: ingresosMesAnt > 0 ? ((ingresosMes - ingresosMesAnt) / ingresosMesAnt) * 100 : null,
    meta, metaDiaria: meta > 0 ? meta / diasMes : 0,
    serie: serie.map((d) => ({ dia: d, monto: sumar(ps.filter((p) => p.dia === d)) })),
    sesiones: (sesiones ?? []).filter((c) => c.estado === "en_captura" || c.estado === "en_edicion").length,
    tomasHoy: (sesiones ?? []).filter((c) => c.fecha_captura === hoy).length,
    procesados: (lab ?? []).filter((p) => p.estado === "procesado").length,
    paraEntregar: (lab ?? []).filter((p) => p.estado === "en_impresion").length,
    porCobrar: sumar(((saldos ?? []) as { saldo: number }[]).map((s) => ({ monto: s.saldo }))),
    conSaldo: (saldos ?? []).length,
    demanda: [...porTipo.entries()].map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
    caja: {
      ingresos: cajas.reduce((s, c) => s + c.ingresos, 0),
      egresos: cajas.reduce((s, c) => s + c.egresos, 0),
      efectivo: cajas.reduce((s, c) => s + c.efectivo, 0),
      digital: cajas.reduce((s, c) => s + c.porMetodo.filter((x) => x.metodo !== "efectivo").reduce((t, x) => t + x.monto, 0), 0),
      cerrada: cajas.every((c) => !!c.cierre),
    },
  };
}
