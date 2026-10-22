"use server";

import Anthropic from "@anthropic-ai/sdk";
import { PERMISOS, requirePerfil } from "@/lib/auth";
import { TIPO_CAMPANA, hoyLima } from "@/lib/formato";
import { deudores } from "@/lib/reportes";
import { NOMBRE_SEDE, SEDES } from "@/lib/sedes";
import { tablero } from "@/lib/tablero";

export type Mensaje = { rol: "usuario" | "asistente"; texto: string };

const SISTEMA = `Eres el asistente del panel de FOTOS JEFFERSON, un estudio de fotografía escolar de Loreto, Perú (promociones, graduaciones y carnets), con tres sedes: Nauta, Iquitos (Liz) e Iquitos (Dan).
Respondes a la familia y al personal que manejan el negocio. Usa solo los datos del panel que recibes; si algo no está ahí, dilo y sugiere en qué sección del panel mirarlo.
Escribe en español sencillo, corto y directo, con montos en soles (S/). Usa listas cortas solo cuando ayuden. No inventes cifras.
Puedes dar ideas prácticas para vender más, cobrar a tiempo y organizar las tomas y entregas, siempre pensando en un negocio familiar pequeño.`;

// Foto del negocio en este momento, en texto compacto, para que el asistente responda con datos reales.
async function datosDelPanel(supabase: Awaited<ReturnType<typeof requirePerfil>>["supabase"]) {
  const hoy = hoyLima();
  const [general, ...porSede] = await Promise.all([tablero(supabase, null, 30), ...SEDES.map(([id]) => tablero(supabase, id, 7))]);
  const [deben, { data: campanas }, { data: materiales }, { data: equipos }, { data: tareas }] = await Promise.all([
    deudores(supabase),
    supabase.from("campanas").select("nombre, tipo, estado, fecha_captura, fecha_entrega, colegios(nombre, sede), alumnos(count)").neq("estado", "cerrada").order("fecha_captura", { nullsFirst: false }).limit(25),
    supabase.from("materiales").select("nombre, stock, minimo, unidad").eq("activo", true),
    supabase.from("equipos").select("nombre, tipo, estado, sede, asignado_a, proximo_mantenimiento").neq("estado", "baja"),
    supabase.from("tareas").select("titulo, vence").eq("hecha", false).order("vence").limit(15),
  ]);
  const r = (n: number) => Math.round(n * 100) / 100;
  return JSON.stringify({
    hoy,
    total_tres_sedes: {
      cobrado_este_mes: r(general.ingresosMes), cobrado_mes_pasado: r(general.ingresosMesAnt), meta_del_mes: general.meta,
      por_cobrar: r(general.porCobrar), pedidos_con_saldo: general.conSaldo, campanas_en_proceso: general.sesiones, tomas_hoy: general.tomasHoy,
      pedidos_por_imprimir: general.procesados, pedidos_por_entregar: general.paraEntregar,
      caja_hoy: general.caja, cobrado_por_dia_ultimos_30: general.serie.filter((d) => d.monto > 0),
      pedidos_por_tipo_90_dias: general.demanda.map((d) => ({ tipo: TIPO_CAMPANA[d.tipo] ?? d.tipo, pedidos: d.n })),
    },
    por_sede: porSede.map((t, i) => ({
      sede: SEDES[i][1], cobrado_este_mes: r(t.ingresosMes), meta: t.meta, por_cobrar: r(t.porCobrar), caja_hoy: t.caja, cobrado_ultimos_7_dias: t.serie,
    })),
    campanas_abiertas: (campanas ?? []).map((c) => {
      const col = c.colegios as unknown as { nombre: string; sede: string } | null;
      return { colegio: col?.nombre, sede: col ? NOMBRE_SEDE[col.sede] : null, campana: c.nombre, tipo: TIPO_CAMPANA[c.tipo], estado: c.estado, toma: c.fecha_captura, entrega: c.fecha_entrega, alumnos: (c.alumnos as unknown as { count: number }[])[0]?.count ?? 0 };
    }),
    deudores_principales: deben.slice(0, 30).map((d) => ({ alumno: d.alumno, colegio: d.colegio, salon: d.salon, saldo: r(d.saldo) })),
    materiales_por_agotarse: (materiales ?? []).filter((m) => Number(m.stock) <= Number(m.minimo)),
    equipos: equipos ?? [],
    recordatorios_pendientes: tareas ?? [],
  });
}

export async function preguntar(historial: Mensaje[]): Promise<{ texto?: string; error?: string }> {
  const { supabase } = await requirePerfil(PERMISOS.reportes);
  if (!process.env.ANTHROPIC_API_KEY) return { error: "El asistente aún no está conectado: falta la clave de IA en la configuración." };
  const ultimos = historial.slice(-12).filter((m) => m.texto.trim()).map((m) => ({ ...m, texto: m.texto.slice(0, 2000) }));
  if (ultimos.length === 0 || ultimos[ultimos.length - 1].rol !== "usuario") return { error: "Escribe una pregunta." };
  while (ultimos[0]?.rol !== "usuario") ultimos.shift();

  const datos = await datosDelPanel(supabase);
  const client = new Anthropic();
  try {
    const respuesta = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Datos del panel ahora mismo (JSON):\n${datos}` },
      ],
      messages: ultimos.map((m) => ({ role: m.rol === "usuario" ? "user" : "assistant", content: m.texto })),
    });
    if (respuesta.stop_reason === "refusal") return { error: "El asistente no pudo responder eso. Prueba preguntarlo de otra forma." };
    const texto = respuesta.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    return texto ? { texto } : { error: "No hubo respuesta. Intenta de nuevo." };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: "La clave de IA no es válida. Revisa la configuración." };
    if (e instanceof Anthropic.RateLimitError) return { error: "Demasiadas preguntas seguidas. Espera un momento." };
    if (e instanceof Anthropic.APIError) return { error: `El servicio de IA falló (${e.status}). Intenta de nuevo.` };
    return { error: "No se pudo conectar con el asistente." };
  }
}
