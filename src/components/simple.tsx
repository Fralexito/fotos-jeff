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

export type Fila = { key: string; titulo: string; sub?: string; valor?: string; tono?: "bien" | "debe" | "suave"; href?: string };

export function SimpleLista({ filas, vacio }: { filas: Fila[]; vacio: string }) {
  if (filas.length === 0) return <p className="simple-vacio">{vacio}</p>;
  return (
    <div className="simple-lista">
      {filas.map((f) => {
        const dentro = (
          <>
            <span className="quien"><b>{f.titulo}</b>{f.sub && <small>{f.sub}</small>}</span>
            {f.valor && <span className={`valor ${f.tono ?? ""}`}>{f.valor}</span>}
            {f.href && <ChevronRight className="flecha" />}
          </>
        );
        return f.href ? (
          <Link key={f.key} className="simple-item" href={f.href}>{dentro}</Link>
        ) : (
          <div key={f.key} className="simple-item">{dentro}</div>
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
