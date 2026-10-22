import { requirePerfil, puede } from "@/lib/auth";
import { IconoSalir } from "@/components/iconos";
import { salir } from "../login/actions";
import { Nav, type ItemNav } from "./nav";

const NOMBRE_ROL = { dueno: "Dueño", operador: "Operador", fotografo: "Fotógrafo" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { perfil } = await requirePerfil();

  const items: ItemNav[] = [
    { href: "/panel", texto: "Inicio", icono: "inicio" },
    { href: "/panel/colegios", texto: "Colegios", icono: "colegios" },
  ];
  if (puede(perfil, "cobros")) items.push({ href: "/panel/cobros", texto: "Cobros", icono: "cobros" });
  if (puede(perfil, "catalogo")) items.push({ href: "/panel/catalogo", texto: "Catálogo", icono: "catalogo" });

  return (
    <div className="app">
      <nav className="side" aria-label="Secciones">
        <div className="brand">
          Fotos Jeff<small>Estudio fotográfico · Nauta</small>
        </div>
        <Nav items={items} />
        <div className="spacer" />
        <p className="who">
          {perfil.nombre} · {NOMBRE_ROL[perfil.rol]}
        </p>
        <form action={salir}>
          <button className="navbtn" type="submit">
            <IconoSalir />
            Salir
          </button>
        </form>
      </nav>
      <main>{children}</main>
    </div>
  );
}
