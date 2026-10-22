"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, School, Settings, Wallet } from "lucide-react";

const ICONOS = { inicio: LayoutDashboard, colegios: School, cobros: Wallet, catalogo: Package, ajustes: Settings };

export type ItemNav = { href: string; texto: string; icono: keyof typeof ICONOS; count?: number };

export function Nav({ items }: { items: ItemNav[] }) {
  const ruta = usePathname();
  return items.map(({ href, texto, icono, count }) => {
    const Icono = ICONOS[icono];
    const activo =
      href === "/panel"
        ? ruta === href
        : ruta.startsWith(href) || (href === "/panel/colegios" && /^\/panel\/(campanas|pedidos)/.test(ruta));
    return (
      <Link key={href} href={href} className={`navlink${icono === "ajustes" ? " hide-mobile" : ""}`} aria-current={activo ? "page" : undefined}>
        <Icono className="i" />
        {texto}
        {!!count && <span className="count">{count}</span>}
      </Link>
    );
  });
}
