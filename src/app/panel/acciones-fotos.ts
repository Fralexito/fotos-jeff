"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePerfil } from "@/lib/auth";

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function volver(fd: FormData, aviso: Record<string, string>): never {
  const ruta = txt(fd, "volver");
  const [camino, query = ""] = (ruta.startsWith("/panel/fotos") ? ruta : "/panel/fotos").split("?");
  const q = new URLSearchParams(query);
  q.delete("ok"); q.delete("error");
  for (const [k, v] of Object.entries(aviso)) q.set(k, v);
  revalidatePath("/panel/fotos");
  redirect(`${camino}?${q}`);
}

// Aprobar, rechazar o devolver a la cola del motor (una o varias fotos).
export async function revisarFotos(fd: FormData) {
  const { supabase, perfil } = await requirePerfil();
  const ids = fd.getAll("id").map(String).filter(Boolean);
  const accion = txt(fd, "accion");
  if (ids.length === 0) volver(fd, { error: "No hay fotos marcadas." });
  const cambios =
    accion === "aprobar" ? { estado: "aprobada", revisada_por: perfil.id, revisada_en: new Date().toISOString() }
    : accion === "rechazar" ? { estado: "rechazada", revisada_por: perfil.id, revisada_en: new Date().toISOString() }
    : accion === "reprocesar" ? { estado: "subida", motivo_excepcion: null, intentos: 0 }
    : null;
  if (!cambios) volver(fd, { error: "Acción no válida." });
  const { error } = await supabase.from("fotos").update(cambios).in("id", ids);
  const n = ids.length;
  const hecho = { aprobar: "aprobada", rechazar: "rechazada", reprocesar: "enviada al motor otra vez" }[accion as "aprobar"];
  volver(fd, error ? { error: "No se pudo guardar." } : { ok: n === 1 ? `Foto ${hecho}.` : `${n} fotos: ${hecho.replace("aprobada", "aprobadas").replace("rechazada", "rechazadas").replace("enviada", "enviadas")}.` });
}

// Color del fondo liso que el motor pone a las fotos de la campaña.
export async function guardarFondo(fd: FormData) {
  const { supabase } = await requirePerfil();
  const hex = txt(fd, "color").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) volver(fd, { error: "Color no válido." });
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
  const { error } = await supabase.from("campanas").update({ fondo_rgb: rgb }).eq("id", txt(fd, "campana_id"));
  volver(fd, error ? { error: "No se pudo guardar el color." } : { ok: "Color de fondo guardado. Se usa en las próximas fotos." });
}
