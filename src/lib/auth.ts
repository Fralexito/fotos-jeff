import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Rol = "dueno" | "operador" | "fotografo";

export type Perfil = { id: string; nombre: string; rol: Rol };

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

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre, rol")
    .eq("id", user.id)
    .single<Perfil>();
  if (!perfil) redirect("/login?error=sin-perfil");
  if (roles && !roles.includes(perfil.rol)) redirect("/panel");

  return { supabase, perfil };
}

export function puede(perfil: Perfil, permiso: keyof typeof PERMISOS) {
  return (PERMISOS[permiso] as Rol[]).includes(perfil.rol);
}
