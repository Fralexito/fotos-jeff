"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISOS, requirePerfil } from "@/lib/auth";
import { resumenCaja } from "@/lib/caja";
import { hoyLima } from "@/lib/formato";
import { sedeValida } from "@/lib/sedes";

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opc = (fd: FormData, k: string) => txt(fd, k) || null;
const num = (fd: FormData, k: string) => {
  const v = txt(fd, k).replace(",", ".");
  return v === "" ? null : Number(v);
};

// Sede del formulario; si no viene, la que la persona tiene elegida arriba (o Nauta).
const sedeDe = (fd: FormData, elegida: string) => {
  const v = txt(fd, "sede") || elegida;
  return sedeValida(v);
};

// Vuelve a la pantalla desde donde se envió el formulario, con un aviso.
function volver(fd: FormData, defecto: string, aviso: Record<string, string>): never {
  const ruta = txt(fd, "volver");
  const base = ruta.startsWith("/panel") ? ruta : defecto;
  const [camino, query = ""] = base.split("?");
  const q = new URLSearchParams(query);
  q.delete("ok"); q.delete("error"); q.delete("nuevo");
  for (const [k, v] of Object.entries(aviso)) q.set(k, v);
  revalidatePath("/panel", "layout");
  redirect(`${camino}?${q}`);
}

// ---------------------------------------------------------------- Clientes

export async function crearOportunidad(fd: FormData) {
  const { supabase, perfil } = await requirePerfil(PERMISOS.clientes);
  const colegio_id = opc(fd, "colegio_id");
  const colegio_nombre = opc(fd, "colegio_nombre");
  const titulo = txt(fd, "titulo") || [colegio_nombre, "Nueva oportunidad"].find(Boolean)!;
  const { error } = await supabase.from("oportunidades").insert({
    titulo, colegio_id, colegio_nombre,
    contacto_nombre: opc(fd, "contacto_nombre"),
    telefono: opc(fd, "telefono"),
    tipo: txt(fd, "tipo") || "promocion",
    alumnos_estimados: num(fd, "alumnos_estimados"),
    monto_estimado: num(fd, "monto_estimado"),
    proxima_accion: opc(fd, "proxima_accion"),
    notas: opc(fd, "notas"),
    responsable: perfil.id,
  });
  if (error) volver(fd, "/panel/clientes", { error: "No se pudo guardar la oportunidad." });
  volver(fd, "/panel/clientes", { ok: "Oportunidad agregada al embudo." });
}

export async function actualizarOportunidad(fd: FormData) {
  const { supabase } = await requirePerfil(PERMISOS.clientes);
  const id = txt(fd, "id");
  const { error } = await supabase.from("oportunidades").update({
    titulo: txt(fd, "titulo"),
    colegio_nombre: opc(fd, "colegio_nombre"),
    contacto_nombre: opc(fd, "contacto_nombre"),
    telefono: opc(fd, "telefono"),
    tipo: txt(fd, "tipo") || "promocion",
    etapa: txt(fd, "etapa") || "nuevo",
    alumnos_estimados: num(fd, "alumnos_estimados"),
    monto_estimado: num(fd, "monto_estimado"),
    proxima_accion: opc(fd, "proxima_accion"),
    notas: opc(fd, "notas"),
  }).eq("id", id);
  if (error) volver(fd, `/panel/clientes/${id}`, { error: "No se pudieron guardar los cambios." });
  volver(fd, `/panel/clientes/${id}`, { ok: "Cambios guardados." });
}

export async function moverOportunidad(fd: FormData) {
  const { supabase, perfil } = await requirePerfil(PERMISOS.clientes);
  const id = txt(fd, "id");
  const etapa = txt(fd, "etapa");
  const { error } = await supabase.from("oportunidades").update({ etapa }).eq("id", id);
  if (!error) {
    await supabase.from("actividades").insert({ oportunidad_id: id, tipo: "nota", detalle: `Pasó a la etapa “${etapa}”.`, registrado_por: perfil.id });
  }
  volver(fd, "/panel/clientes", error ? { error: "No se pudo mover." } : {});
}

// Al ganar un colegio nuevo, lo crea en Colegios y lo enlaza.
export async function convertirEnColegio(fd: FormData) {
  const { supabase } = await requirePerfil(PERMISOS.clientes);
  const id = txt(fd, "id");
  const { data: op } = await supabase.from("oportunidades").select("*").eq("id", id).single();
  if (!op) volver(fd, "/panel/clientes", { error: "No se encontró la oportunidad." });
  const { data: colegio, error } = await supabase
    .from("colegios")
    .insert({
      nombre: op.colegio_nombre || op.titulo,
      codigo: txt(fd, "codigo").toUpperCase().replace(/\s+/g, ""),
      ciudad: txt(fd, "ciudad") || "Nauta",
      contacto_nombre: op.contacto_nombre,
      contacto_telefono: op.telefono,
    })
    .select("id")
    .single();
  if (error || !colegio) volver(fd, `/panel/clientes/${id}`, { error: error?.code === "23505" ? "Ese código ya existe." : "No se pudo crear el colegio." });
  await supabase.from("oportunidades").update({ colegio_id: colegio.id, etapa: "ganado" }).eq("id", id);
  if (op.contacto_nombre) {
    await supabase.from("contactos").insert({ colegio_id: colegio.id, nombre: op.contacto_nombre, telefono: op.telefono, cargo: "otro" });
  }
  revalidatePath("/panel", "layout");
  redirect(`/panel/colegios/${colegio.id}?ok=${encodeURIComponent("Colegio creado. Ahora crea su campaña.")}`);
}

export async function registrarActividad(fd: FormData) {
  const { supabase, perfil } = await requirePerfil();
  const detalle = txt(fd, "detalle");
  if (!detalle) volver(fd, "/panel/clientes", { error: "Escribe qué pasó." });
  const { error } = await supabase.from("actividades").insert({
    tipo: txt(fd, "tipo") || "nota",
    detalle,
    colegio_id: opc(fd, "colegio_id"),
    oportunidad_id: opc(fd, "oportunidad_id"),
    contacto_id: opc(fd, "contacto_id"),
    registrado_por: perfil.id,
  });
  volver(fd, "/panel/clientes", error ? { error: "No se pudo guardar." } : { ok: "Anotado en el historial." });
}

export async function crearTarea(fd: FormData) {
  const { supabase, perfil } = await requirePerfil();
  const titulo = txt(fd, "titulo");
  if (!titulo) volver(fd, "/panel/clientes?vista=tareas", { error: "Escribe el recordatorio." });
  const { error } = await supabase.from("tareas").insert({
    titulo,
    vence: txt(fd, "vence") || hoyLima(),
    colegio_id: opc(fd, "colegio_id"),
    oportunidad_id: opc(fd, "oportunidad_id"),
    asignado_a: opc(fd, "asignado_a") ?? perfil.id,
    creado_por: perfil.id,
  });
  volver(fd, "/panel/clientes?vista=tareas", error ? { error: "No se pudo guardar." } : { ok: "Recordatorio creado." });
}

export async function alternarTarea(fd: FormData) {
  const { supabase } = await requirePerfil();
  await supabase.from("tareas").update({ hecha: txt(fd, "hecha") === "1" }).eq("id", txt(fd, "id"));
  volver(fd, "/panel/clientes?vista=tareas", {});
}

export async function crearContacto(fd: FormData) {
  const { supabase } = await requirePerfil();
  const nombre = txt(fd, "nombre");
  if (!nombre) volver(fd, "/panel/clientes?vista=contactos", { error: "Escribe el nombre." });
  const { error } = await supabase.from("contactos").insert({
    nombre,
    colegio_id: opc(fd, "colegio_id"),
    cargo: txt(fd, "cargo") || "otro",
    telefono: opc(fd, "telefono"),
    email: opc(fd, "email"),
    notas: opc(fd, "notas"),
  });
  volver(fd, "/panel/clientes?vista=contactos", error ? { error: "No se pudo guardar el contacto." } : { ok: "Contacto guardado." });
}

// ---------------------------------------------------------------- Producción

const ESTADOS = ["pendiente", "procesado", "en_impresion", "entregado", "anulado"];

export async function cambiarEstadoPedido(fd: FormData) {
  const { supabase } = await requirePerfil();
  const estado = txt(fd, "estado");
  if (!ESTADOS.includes(estado)) volver(fd, "/panel/produccion", { error: "Estado no válido." });
  const { error } = await supabase.from("pedidos").update({ estado }).eq("id", txt(fd, "id"));
  volver(fd, "/panel/produccion", error ? { error: "No se pudo cambiar el estado." } : {});
}

export async function entregarPedidos(fd: FormData) {
  const { supabase } = await requirePerfil();
  const ids = fd.getAll("pedido").map(String).filter(Boolean);
  if (ids.length === 0) volver(fd, "/panel/produccion", { error: "Marca al menos un pedido." });
  const { error } = await supabase.from("pedidos").update({ estado: "entregado" }).in("id", ids).neq("estado", "anulado");
  volver(fd, "/panel/produccion", error ? { error: "No se pudo registrar la entrega." } : { ok: `${ids.length} ${ids.length === 1 ? "pedido entregado" : "pedidos entregados"}.` });
}

// ---------------------------------------------------------------- Caja

export async function registrarMovimiento(fd: FormData) {
  const { supabase, perfil } = await requirePerfil(PERMISOS.caja);
  const monto = num(fd, "monto");
  if (!monto || monto <= 0) volver(fd, "/panel/caja", { error: "Escribe un monto mayor a cero." });
  const { error } = await supabase.from("movimientos_caja").insert({
    fecha: txt(fd, "fecha") || hoyLima(),
    tipo: txt(fd, "tipo") === "ingreso" ? "ingreso" : "egreso",
    categoria: txt(fd, "categoria") || "Otros",
    concepto: txt(fd, "concepto") || txt(fd, "categoria") || "Sin detalle",
    monto,
    metodo: txt(fd, "metodo") || "efectivo",
    sede: sedeDe(fd, perfil.preferencias.sede),
    registrado_por: perfil.id,
  });
  volver(fd, "/panel/caja", error ? { error: "No se pudo guardar." } : { ok: "Movimiento anotado." });
}

export async function cerrarCaja(fd: FormData) {
  const { supabase, perfil } = await requirePerfil(PERMISOS.caja);
  const fecha = txt(fd, "fecha") || hoyLima();
  const contado = num(fd, "efectivo_contado");
  if (contado === null || contado < 0) volver(fd, "/panel/caja", { error: "Escribe cuánto efectivo hay en caja." });
  const sede = sedeDe(fd, perfil.preferencias.sede);
  const { efectivo } = await resumenCaja(supabase, fecha, sede);
  const { error } = await supabase.from("cierres_caja").insert({
    fecha, sede, efectivo_esperado: efectivo, efectivo_contado: contado, notas: opc(fd, "notas"), cerrado_por: perfil.id,
  });
  if (error) volver(fd, "/panel/caja", { error: error.code === "23505" ? "Ese día ya tiene cierre." : "No se pudo cerrar la caja." });
  const dif = contado - efectivo;
  volver(fd, "/panel/caja", { ok: Math.abs(dif) < 0.005 ? "Caja cerrada: cuadra exacto." : `Caja cerrada con ${dif > 0 ? "sobrante" : "faltante"} de S/ ${Math.abs(dif).toFixed(2)}.` });
}

// ---------------------------------------------------------------- Inventario

export async function crearMaterial(fd: FormData) {
  const { supabase, perfil } = await requirePerfil();
  const nombre = txt(fd, "nombre");
  if (!nombre) volver(fd, "/panel/inventario", { error: "Escribe el nombre del material." });
  const { data, error } = await supabase
    .from("materiales")
    .insert({
      nombre,
      categoria: txt(fd, "categoria") || "Otros",
      unidad: txt(fd, "unidad") || "unid.",
      minimo: num(fd, "minimo") ?? 0,
      costo_unitario: num(fd, "costo_unitario"),
    })
    .select("id")
    .single();
  if (error || !data) volver(fd, "/panel/inventario", { error: "No se pudo guardar el material." });
  const inicial = num(fd, "stock");
  if (inicial && inicial > 0) {
    await supabase.from("movimientos_inventario").insert({ material_id: data.id, motivo: "ajuste", cantidad: inicial, nota: "Stock inicial", registrado_por: perfil.id });
  }
  volver(fd, "/panel/inventario", { ok: "Material agregado." });
}

export async function moverInventario(fd: FormData) {
  const { supabase, perfil } = await requirePerfil();
  const motivo = txt(fd, "motivo");
  const cantidad = Math.abs(num(fd, "cantidad") ?? 0);
  if (!cantidad || !["compra", "uso", "ajuste"].includes(motivo)) volver(fd, "/panel/inventario", { error: "Escribe una cantidad." });
  const signo = motivo === "uso" || txt(fd, "signo") === "-" ? -1 : 1;
  const material_id = txt(fd, "material_id");
  const { error } = await supabase.from("movimientos_inventario").insert({
    material_id, motivo, cantidad: signo * cantidad, nota: opc(fd, "nota"), registrado_por: perfil.id,
  });
  if (error) volver(fd, "/panel/inventario", { error: "No se pudo registrar." });

  // Una compra pagada también es un gasto de caja.
  const costo = num(fd, "costo");
  if (motivo === "compra" && costo && costo > 0 && PERMISOS.caja.includes(perfil.rol as never)) {
    const { data: mat } = await supabase.from("materiales").select("nombre").eq("id", material_id).single();
    await supabase.from("movimientos_caja").insert({
      tipo: "egreso", categoria: "Materiales", concepto: `Compra: ${cantidad} × ${mat?.nombre ?? "material"}`,
      monto: costo, metodo: txt(fd, "metodo") || "efectivo", registrado_por: perfil.id, sede: sedeDe(fd, perfil.preferencias.sede),
    });
  }
  volver(fd, "/panel/inventario", { ok: motivo === "compra" ? "Compra registrada." : motivo === "uso" ? "Salida registrada." : "Stock ajustado." });
}

// ---------------------------------------------------------------- Cámaras y equipos

const ESTADOS_EQUIPO = ["disponible", "en_uso", "mantenimiento", "baja"];

function datosEquipo(fd: FormData, elegida: string) {
  return {
    nombre: txt(fd, "nombre"),
    tipo: txt(fd, "tipo") || "otro",
    marca_modelo: opc(fd, "marca_modelo"),
    serie: opc(fd, "serie"),
    sede: sedeDe(fd, elegida),
    asignado_a: opc(fd, "asignado_a"),
    proximo_mantenimiento: opc(fd, "proximo_mantenimiento"),
    notas: opc(fd, "notas"),
  };
}

export async function guardarEquipo(fd: FormData) {
  const { supabase, perfil } = await requirePerfil();
  const id = opc(fd, "id");
  const datos = datosEquipo(fd, perfil.preferencias.sede);
  if (!datos.nombre) volver(fd, "/panel/equipos", { error: "Escribe el nombre del equipo." });
  const { error } = id ? await supabase.from("equipos").update(datos).eq("id", id) : await supabase.from("equipos").insert(datos);
  volver(fd, "/panel/equipos", error ? { error: "No se pudo guardar el equipo." } : { ok: id ? "Equipo actualizado." : "Equipo agregado." });
}

export async function estadoEquipo(fd: FormData) {
  const { supabase } = await requirePerfil();
  const estado = txt(fd, "estado");
  if (!ESTADOS_EQUIPO.includes(estado)) volver(fd, "/panel/equipos", { error: "Estado no válido." });
  const cambios: Record<string, string | null> = { estado };
  if (estado === "disponible") cambios.asignado_a = null;
  const { error } = await supabase.from("equipos").update(cambios).eq("id", txt(fd, "id"));
  volver(fd, "/panel/equipos", error ? { error: "No se pudo cambiar el estado." } : { ok: "Estado actualizado." });
}
