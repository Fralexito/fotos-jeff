import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  crumbs?: { href: string; label: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="pagehead">
      <div>
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
