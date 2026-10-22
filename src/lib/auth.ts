import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { leerPreferencias, type Preferencias } from "@/lib/preferencias";

export type Rol = "dueno" | "operador" | "fotografo";

export type Perfil = { id: string; nombre: string; telefono: string | null; rol: Rol; preferencias: Preferencias };

// Qué puede ver cada rol. El dueño y el operador manejan dinero; el fotógrafo solo colegios y alumnos.
export const PERMISOS = {
  cobros: ["dueno", "operador"],
  catalogo: ["dueno"],
  pedidos: ["dueno", "operador"],
} satisfies Record<string, Rol[]>;

// Devuelve el perfil del personal o saca al usuario. Con `roles`, además exige uno de esos roles.
export async function requirePerfil(roles?: Rol[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("perfiles")
    .select("id, nombre, telefono, rol, preferencias")
    .eq("id", user.id)
    .single();
  if (!data) redirect("/login?error=sin-perfil");
  const perfil: Perfil = { ...data, preferencias: leerPreferencias(data.preferencias) };
  if (roles && !roles.includes(perfil.rol)) redirect("/panel");

  return { supabase, perfil };
}

export function puede(perfil: Perfil, permiso: keyof typeof PERMISOS) {
  return (PERMISOS[permiso] as Rol[]).includes(perfil.rol);
}
