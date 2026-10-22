import Link from "next/link";
import { Camera, LogOut } from "lucide-react";
import { requirePerfil, puede } from "@/lib/auth";
import { Avatar } from "@/components/ui";
import { salir } from "../login/actions";
import { Nav, type ItemNav } from "./nav";

const NOMBRE_ROL = { dueno: "Dueño", operador: "Operador", fotografo: "Fotógrafo" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { supabase, perfil } = await requirePerfil();

  const gestion: ItemNav[] = [
    { href: "/panel", texto: "Inicio", icono: "inicio" },
    { href: "/panel/colegios", texto: "Colegios y alumnos", icono: "colegios" },
  ];
  const ventas: ItemNav[] = [];
  if (puede(perfil, "cobros")) {
    const { count } = await supabase.from("pagos").select("id", { count: "exact", head: true }).eq("estado", "por_verificar");
    ventas.push({ href: "/panel/cobros", texto: "Cobros", icono: "cobros", count: count ?? 0 });
  }
  if (puede(perfil, "catalogo")) ventas.push({ href: "/panel/catalogo", texto: "Catálogo", icono: "catalogo" });

  return (
    <div className="app">
      <aside className="side" aria-label="Secciones">
        <Link href="/panel" className="logo">
          <span className="mark"><Camera /></span>
          <span>
            <b>Fotos Jeff</b>
            <small>Estudio fotográfico · Nauta</small>
          </span>
        </Link>
        <div className="section">Gestión</div>
        <Nav items={gestion} />
        {ventas.length > 0 && <div className="section">Ventas</div>}
        <Nav items={ventas} />
        <div className="grow" />
        <div className="usercard">
          <Avatar name={perfil.nombre} />
          <div className="who">
            <b>{perfil.nombre}</b>
            <small>{NOMBRE_ROL[perfil.rol]}</small>
          </div>
          <form action={salir}>
            <button type="submit" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut className="i" />
            </button>
          </form>
        </div>
      </aside>
      <main>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
