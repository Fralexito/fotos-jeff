"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, ChartColumn, Factory, Handshake, LayoutDashboard, LayoutGrid, Package, School, Settings, Vault, Wallet } from "lucide-react";

const ICONOS = {
  inicio: LayoutDashboard, clientes: Handshake, colegios: School, produccion: Factory, cobros: Wallet, caja: Vault,
  catalogo: Package, inventario: Boxes, reportes: ChartColumn, ajustes: Settings, mas: LayoutGrid,
};

export type ItemNav = { href: string; texto: string; icono: keyof typeof ICONOS; count?: number; movil?: boolean };

export function Nav({ items }: { items: ItemNav[] }) {
  const ruta = usePathname();
  return items.map(({ href, texto, icono, count, movil }) => {
    const Icono = ICONOS[icono];
    const activo =
      href === "/panel"
        ? ruta === href
        : ruta.startsWith(href) || (href === "/panel/colegios" && /^\/panel\/(campanas|pedidos)/.test(ruta));
    return (
      <Link key={href} href={href} className={`navlink${movil ? "" : " hide-mobile"}${icono === "mas" ? " only-mobile" : ""}`} aria-current={activo ? "page" : undefined}>
        <Icono className="i" />
        {texto}
        {!!count && <span className="count">{count}</span>}
      </Link>
    );
  });
}
