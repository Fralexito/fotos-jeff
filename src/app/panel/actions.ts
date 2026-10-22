"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISOS, requirePerfil } from "@/lib/auth";
import { leerPreferencias, type Preferencias } from "@/lib/preferencias";

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opc = (fd: FormData, k: string) => txt(fd, k) || null;

function volver(ruta: string, aviso: Record<string, string>): never {
  const q = new URLSearchParams(aviso).toString();
  redirect(`${ruta}?${q}`);
}

// Código del alumno para el QR: 6 caracteres sin letras que se confunden (I, L, O, U).
const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function nuevoCodigo(usados: Set<string>) {
  let c: string;
  do c = Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
  while (usados.has(c));
  usados.add(c);
  return c;
}

// ---------------------------------------------------------------- Colegios y campañas

export async function crearColegio(fd: FormData) {
  const { supabase } = await requirePerfil();
  const { data, error } = await supabase
    .from("colegios")
    .insert({
      codigo: txt(fd, "codigo").toUpperCase().replace(/\s+/g, ""),
      nombre: txt(fd, "nombre"),
      ciudad: txt(fd, "ciudad") || "Nauta",
      sede: txt(fd, "sede") === "iquitos" ? "iquitos" : "nauta",
      zona: ["carretera", "rio"].includes(txt(fd, "zona")) ? txt(fd, "zona") : "ciudad",
      director: opc(fd, "director"),
      contacto_nombre: opc(fd, "contacto_nombre"),
      contacto_telefono: opc(fd, "contacto_telefono"),
    })
    .select("id")
    .single();
  if (error) volver("/panel/colegios", { error: error.code === "23505" ? "Ya existe un colegio con ese código." : error.message });
  redirect(`/panel/colegios/${data.id}`);
}

export async function cambiarSedeColegio(fd: FormData) {
  const { supabase } = await requirePerfil();
  const id = txt(fd, "id");
  const { error } = await supabase
    .from("colegios")
    .update({
      sede: txt(fd, "sede") === "iquitos" ? "iquitos" : "nauta",
      zona: ["carretera", "rio"].includes(txt(fd, "zona")) ? txt(fd, "zona") : "ciudad",
      ciudad: txt(fd, "ciudad") || "Nauta",
    })
    .eq("id", id);
  revalidatePath("/panel", "layout");
  volver(`/panel/colegios/${id}`, error ? { error: "No se pudo guardar." } : { ok: "Ubicación guardada." });
}

export async function crearCampana(fd: FormData) {
  const { supabase } = await requirePerfil();
  const colegioId = txt(fd, "colegio_id");
  const { data, error } = await supabase
    .from("campanas")
    .insert({
      colegio_id: colegioId,
      anio: Number(txt(fd, "anio")),
      tipo: txt(fd, "tipo"),
      nombre: txt(fd, "nombre"),
      fecha_captura: opc(fd, "fecha_captura"),
      fecha_entrega: opc(fd, "fecha_entrega"),
    })
    .select("id")
    .single();
  if (error) volver(`/panel/colegios/${colegioId}`, { error: error.code === "23505" ? "Esa campaña ya existe." : error.message });
  redirect(`/panel/campanas/${data.id}`);
}

// ---------------------------------------------------------------- Alumnos

async function codigosUsados(campanaId: string) {
  const { supabase } = await requirePerfil();
  const { data } = await supabase.from("alumnos").select("codigo").eq("campana_id", campanaId);
  return new Set((data ?? []).map((a) => a.codigo as string));
}

export async function agregarAlumno(fd: FormData) {
  const { supabase } = await requirePerfil();
  const campanaId = txt(fd, "campana_id");
  const ruta = `/panel/campanas/${campanaId}`;
  const { error } = await supabase.from("alumnos").insert({
    campana_id: campanaId,
    codigo: nuevoCodigo(await codigosUsados(campanaId)),
    apellidos: txt(fd, "apellidos"),
    nombres: txt(fd, "nombres"),
    grado: opc(fd, "grado"),
    seccion: opc(fd, "seccion")?.toUpperCase() ?? null,
    dni: opc(fd, "dni"),
    apoderado_nombre: opc(fd, "apoderado_nombre"),
    apoderado_telefono: opc(fd, "apoderado_telefono"),
  });
  if (error) volver(ruta, { error: error.message });
  revalidatePath(ruta);
  volver(ruta, { ok: "Alumno agregado." });
}

// Pegar desde Excel: una fila por alumno, columnas separadas por tabulación, punto y coma o coma.
// Orden: Apellidos, Nombres, Grado, Sección, DNI, Apoderado, Teléfono. Solo las dos primeras son obligatorias.
export async function importarAlumnos(fd: FormData) {
  const { supabase } = await requirePerfil();
  const campanaId = txt(fd, "campana_id");
  const ruta = `/panel/campanas/${campanaId}`;
  const usados = await codigosUsados(campanaId);

  const filas = txt(fd, "lista")
    .split(/\r?\n/)
    .map((l) => l.split(/\t|;|,/).map((c) => c.trim()))
    .filter((c) => c[0] && c[1] && !/^apellido/i.test(c[0]));
  if (filas.length === 0) volver(ruta, { error: "No encontré alumnos. Revisa que cada fila tenga apellidos y nombres." });

  const { error } = await supabase.from("alumnos").insert(
    filas.map(([apellidos, nombres, grado, seccion, dni, apoderado, telefono]) => ({
      campana_id: campanaId,
      codigo: nuevoCodigo(usados),
      apellidos,
      nombres,
      grado: grado || null,
      seccion: seccion?.toUpperCase() || null,
      dni: dni || null,
      apoderado_nombre: apoderado || null,
      apoderado_telefono: telefono || null,
    })),
  );
  if (error) volver(ruta, { error: error.message });
  revalidatePath(ruta);
  volver(ruta, { ok: `${filas.length} alumnos agregados.` });
}

// ---------------------------------------------------------------- Pedidos y pagos

export async function crearPedido(fd: FormData) {
  const { supabase } = await requirePerfil(PERMISOS.pedidos);
  const alumnoId = txt(fd, "alumno_id");
  const campanaId = txt(fd, "campana_id");
  const ruta = `/panel/pedidos/nuevo`;

  const { data: productos } = await supabase.from("productos").select("id, precio").eq("activo", true);
  const items = (productos ?? [])
    .map((p) => ({ producto_id: p.id as string, cantidad: Number(fd.get(`cant_${p.id}`) ?? 0), precio_unitario: Number(p.precio) }))
    .filter((i) => Number.isInteger(i.cantidad) && i.cantidad > 0);
  if (items.length === 0) volver(ruta, { error: "Elige al menos un producto.", alumno: alumnoId });

  const total = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert({ campana_id: campanaId, alumno_id: alumnoId, total, notas: opc(fd, "notas") })
    .select("id, numero")
    .single();
  if (error) volver(ruta, { error: error.message, alumno: alumnoId });

  const { error: e2 } = await supabase.from("pedido_items").insert(items.map((i) => ({ ...i, pedido_id: pedido.id })));
  if (e2) {
    await supabase.from("pedidos").delete().eq("id", pedido.id);
    volver(ruta, { error: e2.message, alumno: alumnoId });
  }
  revalidatePath("/panel/cobros");
  volver("/panel/cobros", { ok: `Pedido N.º ${pedido.numero} creado.`, q: txt(fd, "alumno_nombre") });
}

export async function registrarPago(fd: FormData) {
  const { supabase, perfil } = await requirePerfil(PERMISOS.cobros);
  const metodo = txt(fd, "metodo");
  const monto = Number(txt(fd, "monto").replace(",", "."));
  const operacion = opc(fd, "operacion");
  const q = txt(fd, "q");

  if (!(monto > 0)) volver("/panel/cobros", { error: "Escribe un monto mayor a cero.", q });
  if ((metodo === "yape" || metodo === "plin") && !operacion)
    volver("/panel/cobros", { error: "Para Yape o Plin escribe el número de operación.", q });

  // El efectivo lo recibe quien registra; Yape y Plin quedan por verificar contra el celular del negocio.
  const { error } = await supabase.from("pagos").insert({
    pedido_id: txt(fd, "pedido_id"),
    monto,
    metodo,
    operacion,
    estado: metodo === "efectivo" ? "confirmado" : "por_verificar",
    registrado_por: perfil.id,
  });
  if (error) volver("/panel/cobros", { error: error.message, q });
  revalidatePath("/panel");
  revalidatePath("/panel/cobros");
  volver("/panel/cobros", { ok: `Pago de S/ ${monto.toFixed(2)} anotado.`, q });
}

export async function verificarPago(fd: FormData) {
  const { supabase } = await requirePerfil(PERMISOS.cobros);
  const estado = txt(fd, "estado") === "confirmado" ? "confirmado" : "rechazado";
  const { error } = await supabase.from("pagos").update({ estado }).eq("id", txt(fd, "pago_id")).eq("estado", "por_verificar");
  if (error) volver("/panel/cobros", { error: error.message });
  revalidatePath("/panel");
  revalidatePath("/panel/cobros");
  volver("/panel/cobros", { ok: estado === "confirmado" ? "Pago confirmado." : "Pago rechazado." });
}

// ---------------------------------------------------------------- Catálogo

export async function crearProducto(fd: FormData) {
  const { supabase } = await requirePerfil(PERMISOS.catalogo);
  const { error } = await supabase.from("productos").insert({
    codigo: txt(fd, "codigo").toLowerCase().replace(/\s+/g, "_"),
    nombre: txt(fd, "nombre"),
    descripcion: opc(fd, "descripcion"),
    precio: Number(txt(fd, "precio").replace(",", ".")),
    es_combo: fd.get("es_combo") === "on",
    categoria: categoriaValida(txt(fd, "categoria")),
    nivel: categoriaValida(txt(fd, "categoria")) === "promocion" ? nivelValido(txt(fd, "nivel")) : null,
  });
  if (error) volver("/panel/catalogo", { error: error.code === "23505" ? "Ya existe un producto con ese código." : error.message });
  revalidatePath("/panel/catalogo");
  volver("/panel/catalogo", { ok: "Producto agregado." });
}

const nivelValido = (v: string) => (["inicial", "primaria", "secundaria", "superior"].includes(v) ? v : null);

const categoriaValida = (v: string) => (["promocion", "graduacion", "carnet"].includes(v) ? v : "otro");

// Categoría del producto; el nivel solo se guarda en las promociones.
export async function cambiarCategoriaProducto(fd: FormData) {
  const { supabase } = await requirePerfil(PERMISOS.catalogo);
  const categoria = categoriaValida(txt(fd, "categoria"));
  await supabase
    .from("productos")
    .update({ categoria, nivel: categoria === "promocion" ? nivelValido(txt(fd, "nivel")) : null })
    .eq("id", txt(fd, "id"));
  revalidatePath("/panel/catalogo");
}

export async function alternarProducto(fd: FormData) {
  const { supabase } = await requirePerfil(PERMISOS.catalogo);
  await supabase.from("productos").update({ activo: fd.get("activo") === "true" }).eq("id", txt(fd, "id"));
  revalidatePath("/panel/catalogo");
}

// ---------------------------------------------------------------- Ajustes

export async function guardarPreferencias(preferencias: Preferencias) {
  const { supabase, perfil } = await requirePerfil();
  const { error } = await supabase
    .from("perfiles")
    .update({ preferencias: leerPreferencias(preferencias) })
    .eq("id", perfil.id);
  if (error) return { error: "No se pudo guardar. Intenta otra vez." };
  revalidatePath("/panel", "layout");
  return { ok: true };
}

export async function guardarMiPerfil(fd: FormData) {
  const { supabase, perfil } = await requirePerfil();
  const nombre = txt(fd, "nombre");
  if (!nombre) volver("/panel/ajustes", { error: "Escribe tu nombre." });
  const { error } = await supabase.from("perfiles").update({ nombre, telefono: opc(fd, "telefono") }).eq("id", perfil.id);
  if (error) volver("/panel/ajustes", { error: "No se pudo guardar tu perfil." });
  revalidatePath("/panel", "layout");
  volver("/panel/ajustes", { ok: "Perfil guardado." });
}

export async function guardarSede(fd: FormData) {
  const { supabase } = await requirePerfil(["dueno"]);
  const { error } = await supabase
    .from("sedes")
    .update({ encargado: opc(fd, "encargado"), telefono: opc(fd, "telefono"), direccion: opc(fd, "direccion") })
    .eq("id", txt(fd, "id"));
  revalidatePath("/panel/ajustes");
  volver("/panel/ajustes", error ? { error: "No se pudo guardar la sede." } : { ok: "Sede guardada." });
}
