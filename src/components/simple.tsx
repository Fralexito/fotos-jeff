import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Piezas de la vista sencilla: pensadas como una app de celular, con letra grande y una cosa por fila.

export function SimpleTitulo({ titulo, volver, sub }: { titulo: string; volver?: { href: string; texto: string }; sub?: string }) {
  return (
    <header className="simple-hola">
      {volver && <Link className="simple-volver" href={volver.href}><ChevronLeft /> {volver.texto}</Link>}
      <h1>{titulo}</h1>
      {sub && <p>{sub}</p>}
    </header>
  );
}

export type Fila = { key: string; titulo: string; sub?: string; valor?: string; tono?: "bien" | "debe" | "suave"; href?: string; avatar?: string };

// Círculo de color con iniciales: el mismo nombre siempre da el mismo color.
export function SimpleAvatar({ nombre }: { nombre: string }) {
  const limpio = nombre.replace(/^(I\.?E\.?|Colegio|IEP|I\.E\.P\.)\s+/i, "").replace(/[,.]/g, " ");
  const partes = limpio.split(/\s+/).filter(Boolean);
  const ini = ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) % 360;
  return <span className="simple-av" style={{ "--h": h } as React.CSSProperties} aria-hidden>{ini}</span>;
}

export function SimpleLista({ filas, vacio }: { filas: Fila[]; vacio: string }) {
  if (filas.length === 0) return <p className="simple-vacio">{vacio}</p>;
  return (
    <div className="simple-lista">
      {filas.map((f, i) => {
        const dentro = (
          <>
            {f.avatar && <SimpleAvatar nombre={f.avatar} />}
            <span className="quien"><b>{f.titulo}</b>{f.sub && <small>{f.sub}</small>}</span>
            {f.valor && <span className={`valor ${f.tono ?? ""}`}>{f.valor}</span>}
            {f.href && <ChevronRight className="flecha" />}
          </>
        );
        return f.href ? (
          <Link key={f.key} className="simple-item" href={f.href} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>{dentro}</Link>
        ) : (
          <div key={f.key} className="simple-item" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>{dentro}</div>
        );
      })}
    </div>
  );
}

export function SimpleNumeros({ items }: { items: { texto: string; valor: string; tono?: "bien" | "debe"; href?: string }[] }) {
  return (
    <div className="simple-numeros">
      {items.map((i) => {
        const dentro = (<><small>{i.texto}</small><b className={i.tono === "debe" ? "debe" : i.tono === "bien" ? "" : "neutro"}>{i.valor}</b></>);
        return i.href ? <Link key={i.texto} href={i.href}>{dentro}</Link> : <div key={i.texto} className="simple-num">{dentro}</div>;
      })}
    </div>
  );
}
