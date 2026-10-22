"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconoCatalogo, IconoCobro, IconoColegio, IconoInicio } from "@/components/iconos";

const ICONOS = { inicio: IconoInicio, colegios: IconoColegio, cobros: IconoCobro, catalogo: IconoCatalogo };

export type ItemNav = { href: string; texto: string; icono: keyof typeof ICONOS };

export function Nav({ items }: { items: ItemNav[] }) {
  const ruta = usePathname();
  return items.map(({ href, texto, icono }) => {
    const Icono = ICONOS[icono];
    const activo = href === "/panel" ? ruta === href : ruta.startsWith(href) || (href === "/panel/colegios" && ruta.startsWith("/panel/campanas"));
    return (
      <Link key={href} href={href} className="navbtn" aria-current={activo ? "page" : undefined}>
        <Icono />
        {texto}
      </Link>
    );
  });
}
