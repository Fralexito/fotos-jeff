import Link from "next/link";
import { Boxes, CalendarDays, Camera, ChartColumn, Factory, Handshake, Images, LayoutDashboard, Package, School, Settings, Sheet, Sparkles, Sun, Vault, Wallet } from "lucide-react";
import { LogOut } from "lucide-react";
import { puede, requirePerfil } from "@/lib/auth";
import { salir } from "../../login/actions";
import { PageHeader } from "@/components/ui";

const GRUPOS = [["dia", "El día a día"], ["dinero", "Dinero"], ["colegios", "Colegios y clientes"], ["fotos", "Fotos y entregas"], ["cuenta", "Tu cuenta"]];

// Todas las secciones agrupadas (en celular, la barra de abajo solo muestra cinco).
export default async function Mas() {
  const { perfil } = await requirePerfil();
  // En la vista sencilla no se repite Inicio (ya está abajo) ni la tabla tipo Excel.
  const sencilla = perfil.preferencias.vista === "sencilla";
  const secciones = [
    { g: "dia", href: "/panel", t: "Inicio", d: "Resumen del día", I: LayoutDashboard, ok: !sencilla },
    { g: "dia", href: "/panel/hoy", t: "Resumen del día", d: "Todo el negocio en una pantalla", I: Sun, ok: true },
    { g: "colegios", href: "/panel/clientes", t: "Clientes", d: "Embudo, contactos y recordatorios", I: Handshake, ok: puede(perfil, "clientes") },
    { g: "colegios", href: "/panel/colegios", t: "Colegios y alumnos", d: "Campañas y listas", I: School, ok: true },
    { g: "dia", href: "/panel/calendario", t: "Calendario", d: "Tomas, entregas y recordatorios", I: CalendarDays, ok: true },
    { g: "colegios", href: "/panel/tabla", t: "Tabla general", d: "Todo ordenado como en Excel", I: Sheet, ok: !sencilla },
    { g: "fotos", href: "/panel/fotos", t: "Fotos", d: "Subir, editar y aprobar fotos", I: Images, ok: true },
    { g: "fotos", href: "/panel/produccion?vista=tablero", t: "Producción", d: "Edición, impresión y entregas", I: Factory, ok: true },
    { g: "dinero", href: "/panel/cobros", t: "Cobros", d: "Quién pagó y quién debe", I: Wallet, ok: puede(perfil, "cobros") },
    { g: "dinero", href: "/panel/caja", t: "Caja", d: "Ingresos, gastos y cierre", I: Vault, ok: puede(perfil, "caja") },
    { g: "dinero", href: "/panel/catalogo", t: "Catálogo", d: "Productos y precios", I: Package, ok: puede(perfil, "catalogo") },
    { g: "fotos", href: "/panel/inventario", t: "Inventario", d: "Papel, marcos y tinta", I: Boxes, ok: true },
    { g: "fotos", href: "/panel/equipos", t: "Cámaras y equipos", d: "Equipo por sede y mantenimiento", I: Camera, ok: true },
    { g: "dinero", href: "/panel/reportes", t: "Reportes", d: "Ventas, cobros y deudores", I: ChartColumn, ok: puede(perfil, "reportes") },
    { g: "dia", href: "/panel/asistente", t: "Asistente IA", d: "Pregunta lo que quieras del negocio", I: Sparkles, ok: puede(perfil, "reportes") },
    { g: "cuenta", href: "/panel/ajustes", t: "Ajustes", d: "Colores, letra y perfil", I: Settings, ok: true },
  ].filter((s) => s.ok);
  return (
    <>
      <PageHeader title="Todas las secciones" />
      {GRUPOS.map(([g, titulo]) => {
        const items = secciones.filter((s) => s.g === g);
        if (items.length === 0) return null;
        return (
          <section key={g} className="mas-grupo">
            <h2>{titulo}</h2>
            <div className="mas-grid">
              {items.map(({ href, t, d, I }) => (
                <Link key={href} href={href}>
                  <span className="ico"><I /></span>
                  <span><b>{t}</b><small>{d}</small></span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      <form action={salir} className="mas-salir">
        <button type="submit" className="btn secondary"><LogOut className="i" /> Cerrar sesión ({perfil.nombre.split(" ")[0]})</button>
      </form>
    </>
  );
}
