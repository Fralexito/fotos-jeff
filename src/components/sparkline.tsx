// Mini gráfico de los últimos días: área suave y punto en el día de hoy.
export function Sparkline({ datos, etiquetas }: { datos: number[]; etiquetas: string[] }) {
  const w = 280, h = 72, pad = 6;
  const max = Math.max(...datos, 1);
  const pts = datos.map((v, i) => [pad + (i * (w - pad * 2)) / Math.max(datos.length - 1, 1), h - pad - (v / max) * (h - pad * 2 - 8)]);
  const linea = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${linea} L${pts.at(-1)![0]},${h} L${pts[0][0]},${h} Z`;
  const [ux, uy] = pts.at(-1)!;
  return (
    <figure className="spark">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="spark-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6ee7b7" stopOpacity=".45" />
            <stop offset="1" stopColor="#6ee7b7" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spark-g)" />
        <path className="spark-line" d={linea} fill="none" stroke="#6ee7b7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
        <circle cx={ux} cy={uy} r="4" fill="#fff" stroke="#6ee7b7" strokeWidth="2.5" />
      </svg>
      <figcaption>
        {etiquetas.map((e, i) => <span key={i}>{e}</span>)}
      </figcaption>
    </figure>
  );
}
