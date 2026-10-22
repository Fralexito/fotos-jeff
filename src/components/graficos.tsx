import { S } from "@/lib/formato";

// Gráficos simples hechos con HTML y SVG, sin librerías. Los colores vienen de --g1…--g5 (globals.css),
// validados para daltonismo en modo claro y oscuro. Cada marca muestra su valor al pasar el mouse o tocarla.

type Formato = "soles" | "num";
const fmt = (v: number, f: Formato) => (f === "soles" ? S(v) : v.toLocaleString("es-PE"));
const corto = (v: number, f: Formato) =>
  f === "soles" ? (v >= 1000 ? `S/ ${(v / 1000).toLocaleString("es-PE", { maximumFractionDigits: 1 })}k` : `S/ ${Math.round(v)}`) : String(Math.round(v));
const color = (i: number) => `var(--g${(i % 5) + 1})`;

// Escala "bonita" para el eje: 0, paso, 2·paso… cubriendo el máximo.
function escala(max: number) {
  if (max <= 0) return { tope: 1, marcas: [0] };
  const bruto = max / 3;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto)!;
  const tope = Math.ceil(max / paso) * paso;
  return { tope, marcas: Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso) };
}

export function Leyenda({ series, valores, formato = "soles" }: { series: string[]; valores?: number[]; formato?: Formato }) {
  return (
    <ul className="g-leyenda">
      {series.map((s, i) => (
        <li key={s}><span className="g-punto" style={{ background: color(i) }} />{s}{valores && <b>{fmt(valores[i], formato)}</b>}</li>
      ))}
    </ul>
  );
}

// Barras verticales: una o varias series lado a lado, todas en la misma escala.
export function Barras({ grupos, series, formato = "soles", alto = 200, resaltar }: {
  grupos: { etiqueta: string; valores: number[] }[]; series: string[]; formato?: Formato; alto?: number; resaltar?: number;
}) {
  const { tope, marcas } = escala(Math.max(0, ...grupos.flatMap((g) => g.valores)));
  return (
    <figure className="g-barras" style={{ "--alto": `${alto}px` } as React.CSSProperties}>
      {series.length > 1 && <Leyenda series={series} />}
      <div className="g-plano" role="img" aria-label={series.join(" y ")}>
        <div className="g-eje" aria-hidden>
          {marcas.map((m) => <span key={m} style={{ bottom: `${(m / tope) * 100}%` }}>{corto(m, formato)}</span>)}
        </div>
        <div className={`g-columnas${grupos.length > 8 ? " muchas" : ""}`}>
          {marcas.map((m) => <span key={m} className="g-linea" style={{ bottom: `${(m / tope) * 100}%` }} aria-hidden />)}
          {grupos.map((g, gi) => (
            <div key={gi} className={`g-grupo${resaltar === gi ? " resaltado" : ""}`}>
              <div className="g-pila">
                {g.valores.map((v, si) => (
                  <span
                    key={si}
                    className="g-barra"
                    tabIndex={0}
                    data-tip={`${g.etiqueta}${series.length > 1 ? ` · ${series[si]}` : ""}: ${fmt(v, formato)}`}
                    style={{ height: `${(v / tope) * 100}%`, background: color(si), animationDelay: `${gi * 25}ms` }}
                  />
                ))}
              </div>
              <span className="g-etq" data-corto={g.etiqueta.slice(0, 1)}>{g.etiqueta}</span>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}

// Dona con leyenda: partes de un total (máx. 5 colores; lo demás se junta en "Otros").
export function Dona({ partes, centro, formato = "soles" }: {
  partes: { nombre: string; valor: number }[]; centro: { valor: string; texto: string }; formato?: Formato;
}) {
  const orden = [...partes].filter((p) => p.valor > 0);
  const lista = orden.length > 5 ? [...orden.slice(0, 4), { nombre: "Otros", valor: orden.slice(4).reduce((s, p) => s + p.valor, 0) }] : orden;
  const total = lista.reduce((s, p) => s + p.valor, 0);
  const r = 42, c = 2 * Math.PI * r, hueco = lista.length > 1 ? 1.2 : 0;
  let acum = 0;
  return (
    <figure className="g-dona">
      <div className="g-dona-svg">
        <svg viewBox="0 0 100 100" role="img" aria-label={lista.map((p) => `${p.nombre} ${fmt(p.valor, formato)}`).join(", ")}>
          <circle cx="50" cy="50" r={r} fill="none" className="g-dona-fondo" strokeWidth="13" />
          {total > 0 && lista.map((p, i) => {
            const largo = (p.valor / total) * c;
            const seg = (
              <circle
                key={p.nombre} cx="50" cy="50" r={r} fill="none" strokeWidth="13" tabIndex={0}
                stroke={color(i)} strokeDasharray={`${Math.max(largo - hueco, 0.01)} ${c}`} strokeDashoffset={-acum}
                transform="rotate(-90 50 50)" className="g-dona-seg"
              >
                <title>{`${p.nombre}: ${fmt(p.valor, formato)} (${Math.round((p.valor / total) * 100)}%)`}</title>
              </circle>
            );
            acum += largo;
            return seg;
          })}
        </svg>
        <div className="g-dona-centro"><b>{centro.valor}</b><small>{centro.texto}</small></div>
      </div>
      {total === 0 ? <p className="muted-text">Aún no hay datos.</p> : (
        <ul className="g-leyenda g-leyenda-col">
          {lista.map((p, i) => (
            <li key={p.nombre}>
              <span className="g-punto" style={{ background: color(i) }} />
              <span className="g-ley-nom">{p.nombre}</span>
              <b>{fmt(p.valor, formato)}</b>
              <small>{Math.round((p.valor / total) * 100)}%</small>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

// Barras horizontales apiladas (p. ej. cobrado + falta por sede), con el total a la derecha.
export function Apiladas({ filas, series, formato = "soles" }: {
  filas: { etiqueta: string; valores: number[] }[]; series: string[]; formato?: Formato;
}) {
  const max = Math.max(1, ...filas.map((f) => f.valores.reduce((a, b) => a + b, 0)));
  return (
    <figure className="g-apiladas">
      <Leyenda series={series} />
      {filas.map((f) => {
        const total = f.valores.reduce((a, b) => a + b, 0);
        return (
          <div className="g-fila" key={f.etiqueta}>
            <span className="g-fila-nom">{f.etiqueta}</span>
            <div className="g-fila-barra">
              {f.valores.map((v, i) => v > 0 && (
                <span key={i} className="g-seg" tabIndex={0} data-tip={`${f.etiqueta} · ${series[i]}: ${fmt(v, formato)}`} style={{ width: `${(v / max) * 100}%`, background: color(i) }} />
              ))}
            </div>
            <b className="g-fila-total">{fmt(total, formato)}</b>
          </div>
        );
      })}
    </figure>
  );
}
