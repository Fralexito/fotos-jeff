import Link from "next/link";
import {
  Boxes, ChartColumn, ChevronRight, Factory, Handshake, LayoutDashboard, Package, School, Search, Settings, Sheet, Vault, Wallet, type LucideIcon,
} from "lucide-react";

// Cada sección tiene su ícono y su color, para ubicarse de un vistazo.
export const MODULOS: Record<string, LucideIcon> = {
  inicio: LayoutDashboard, clientes: Handshake, colegios: School, produccion: Factory, cobros: Wallet, caja: Vault,
  catalogo: Package, inventario: Boxes, reportes: ChartColumn, ajustes: Settings, buscar: Search, tabla: Sheet,
};

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
  modulo,
}: {
  modulo?: keyof typeof MODULOS;
  title: string;
  subtitle?: React.ReactNode;
  crumbs?: { href: string; label: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="pagehead">
      {modulo && (() => {
        const Icono = MODULOS[modulo];
        return <span className="modico" data-modulo={modulo} aria-hidden><Icono /></span>;
      })()}
      <div className="pagehead-text">
        {crumbs && (
          <nav className="crumbs" aria-label="Ruta">
            {crumbs.map((c) => (
              <span key={c.href} style={{ display: "contents" }}>
                <Link href={c.href}>{c.label}</Link>
                <ChevronRight className="i" style={{ width: 14, height: 14 }} />
              </span>
            ))}
          </nav>
        )}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}

// Iniciales con un color estable por nombre, para reconocer a cada persona de un vistazo.
export function Avatar({ name, square }: { name: string; square?: boolean }) {
  const limpio = name.replace(/^(I\.?\s?E\.?\s?P?\.?|Colegio)\s+/i, "");
  const parts = limpio.replace(/[^\p{L}\s]/gu, "").trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  const color = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 6;
  return (
    <span className={`avatar c${color}${square ? " sq" : ""}`} aria-hidden>
      {initials || "?"}
    </span>
  );
}

export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="ico"><Icon className="i" /></div>
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

// Pestañas de una sección (enlaces, así cada vista tiene su propia URL).
export function Tabs({ items }: { items: { href: string; label: string; count?: number; active: boolean }[] }) {
  return (
    <nav className="tabs" aria-label="Vistas">
      {items.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined}>
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

// Botón verde de WhatsApp con mensaje listo; no se muestra si no hay número.
export function WhatsApp({ href, label = "WhatsApp", sm = true }: { href: string | null; label?: string; sm?: boolean }) {
  if (!href) return null;
  return (
    <a className={`btn wa${sm ? " sm" : ""}`} href={href} target="_blank" rel="noopener noreferrer">
      <svg className="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
      </svg>
      {label}
    </a>
  );
}
