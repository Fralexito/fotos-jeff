import Link from "next/link";
import { Camera, LogOut } from "lucide-react";
import { requirePerfil, puede } from "@/lib/auth";
import { hoyLima } from "@/lib/formato";
import { Avatar } from "@/components/ui";
import { salir } from "../login/actions";
import { Suspense } from "react";
import { Nav, type ItemNav } from "./nav";
import { Topbar } from "./topbar";

const NOMBRE_ROL = { dueno: "Dueño", operador: "Operador", fotografo: "Fotógrafo" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { supabase, perfil } = await requirePerfil();

  const dinero = puede(perfil, "cobros");
  const [{ count: porVerificar }, { count: tareasHoy }] = await Promise.all([
    dinero
      ? supabase.from("pagos").select("id", { count: "exact", head: true }).eq("estado", "por_verificar")
      : Promise.resolve({ count: 0 }),
    supabase.from("tareas").select("id", { count: "exact", head: true }).eq("hecha", false).lte("vence", hoyLima()),
  ]);

  // En celular solo caben 5 accesos abajo; el resto queda en "Más".
  const gestion: ItemNav[] = [
    { href: "/panel", texto: "Inicio", icono: "inicio", movil: true },
    { href: "/panel/hoy", texto: "Resumen del día", icono: "hoy" },
    ...(puede(perfil, "clientes")
      ? [{ href: "/panel/clientes", texto: "Clientes", icono: "clientes", count: tareasHoy ?? 0, movil: true } as ItemNav]
      : []),
    { href: "/panel/colegios", texto: "Colegios y alumnos", icono: "colegios" },
    { href: "/panel/calendario", texto: "Calendario", icono: "calendario" },
    { href: "/panel/tabla", texto: "Tabla general", icono: "tabla" },
    { href: "/panel/fotos", texto: "Fotos", icono: "fotos" },
    { href: "/panel/produccion", texto: "Producción", icono: "produccion", movil: true },
  ];
  const ventas: ItemNav[] = [];
  if (dinero) {
    ventas.push({ href: "/panel/cobros", texto: "Cobros", icono: "cobros", count: porVerificar ?? 0, movil: true });
    ventas.push({ href: "/panel/caja", texto: "Caja", icono: "caja" });
  }
  if (puede(perfil, "catalogo")) ventas.push({ href: "/panel/catalogo", texto: "Catálogo", icono: "catalogo" });
  const operacion: ItemNav[] = [{ href: "/panel/inventario", texto: "Inventario", icono: "inventario" }];
  if (puede(perfil, "reportes")) operacion.push({ href: "/panel/reportes", texto: "Reportes", icono: "reportes" });
  const cuenta: ItemNav[] = [
    { href: "/panel/ajustes", texto: "Ajustes", icono: "ajustes" },
    { href: "/panel/mas", texto: "Más", icono: "mas", movil: true },
  ];
  const p = perfil.preferencias;
  const sencilla = p.vista === "sencilla";
  // Vista sencilla: solo las cuatro tareas del día a día y un acceso a todo lo demás.
  const esencial: ItemNav[] = [
    gestion[0],
    gestion[1],
    ...ventas.filter((i) => i.icono === "cobros"),
    ...gestion.filter((i) => i.icono === "produccion" || i.icono === "clientes"),
    { href: "/panel/mas", texto: "Todas las secciones", icono: "mas", movil: true },
  ];

  return (
    <div className="app" data-vista={p.vista} data-color={p.color} data-tema={p.tema} data-letra={p.letra} data-densidad={p.densidad}>
      <aside className="side" aria-label="Secciones">
        <Link href="/panel" className="logo">
          <span className="mark"><Camera /></span>
          <span>
            <b>Fotos Jefferson</b>
            <small>Estudio fotográfico · Nauta</small>
          </span>
        </Link>
        <nav className="side-nav" aria-label="Menú">
        {sencilla ? (
          <>
            <div className="section">Lo de cada día</div>
            <Nav items={esencial} />
            <div className="section hide-mobile">Cuenta</div>
            <Nav items={[cuenta[0]]} />
          </>
        ) : (
          <>
          <div className="section">Gestión</div>
          <Nav items={gestion} />
          {ventas.length > 0 && <div className="section">Ventas</div>}
          <Nav items={ventas} />
          <div className="section">Operación</div>
          <Nav items={operacion} />
          <div className="section hide-mobile">Cuenta</div>
          <Nav items={cuenta} />
          </>
        )}
        </nav>
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
        <Suspense>
          <Topbar cobros={dinero} catalogo={puede(perfil, "catalogo")} clientes={puede(perfil, "clientes")} prefs={p} />
        </Suspense>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
