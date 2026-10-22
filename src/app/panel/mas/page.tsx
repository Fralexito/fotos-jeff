import Link from "next/link";
import { Boxes, CalendarDays, ChartColumn, Factory, Handshake, Images, LayoutDashboard, Package, School, Settings, Sheet, Sun, Vault, Wallet } from "lucide-react";
import { LogOut } from "lucide-react";
import { puede, requirePerfil } from "@/lib/auth";
import { salir } from "../../login/actions";
import { PageHeader } from "@/components/ui";

// Todas las secciones en tarjetas grandes (en celular, la barra de abajo solo muestra cinco).
export default async function Mas() {
  const { perfil } = await requirePerfil();
  const secciones = [
    { href: "/panel", t: "Inicio", d: "Resumen del día", I: LayoutDashboard, ok: true },
    { href: "/panel/hoy", t: "Resumen del día", d: "Todo el negocio en una pantalla", I: Sun, ok: true },
    { href: "/panel/clientes", t: "Clientes", d: "Embudo, contactos y recordatorios", I: Handshake, ok: puede(perfil, "clientes") },
    { href: "/panel/colegios", t: "Colegios y alumnos", d: "Campañas y listas", I: School, ok: true },
    { href: "/panel/calendario", t: "Calendario", d: "Tomas, entregas y recordatorios", I: CalendarDays, ok: true },
    { href: "/panel/tabla", t: "Tabla general", d: "Todo ordenado como en Excel", I: Sheet, ok: true },
    { href: "/panel/fotos", t: "Fotos", d: "Subir, editar y aprobar fotos", I: Images, ok: true },
    { href: "/panel/produccion", t: "Producción", d: "Edición, impresión y entregas", I: Factory, ok: true },
    { href: "/panel/cobros", t: "Cobros", d: "Quién pagó y quién debe", I: Wallet, ok: puede(perfil, "cobros") },
    { href: "/panel/caja", t: "Caja", d: "Ingresos, gastos y cierre", I: Vault, ok: puede(perfil, "caja") },
    { href: "/panel/catalogo", t: "Catálogo", d: "Productos y precios", I: Package, ok: puede(perfil, "catalogo") },
    { href: "/panel/inventario", t: "Inventario", d: "Papel, marcos y tinta", I: Boxes, ok: true },
    { href: "/panel/reportes", t: "Reportes", d: "Ventas, cobros y deudores", I: ChartColumn, ok: puede(perfil, "reportes") },
    { href: "/panel/ajustes", t: "Ajustes", d: "Colores, letra y perfil", I: Settings, ok: true },
  ].filter((s) => s.ok);
  return (
    <>
      <PageHeader title="Todas las secciones" />
      <div className="quick">
        {secciones.map(({ href, t, d, I }) => (
          <Link key={href} href={href}>
            <span className="ico"><I /></span>
            <span><b>{t}</b><span>{d}</span></span>
          </Link>
        ))}
      </div>
      <form action={salir} className="mas-salir">
        <button type="submit" className="btn secondary"><LogOut className="i" /> Cerrar sesión ({perfil.nombre.split(" ")[0]})</button>
      </form>
    </>
  );
}
