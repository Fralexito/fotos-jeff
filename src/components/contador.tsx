"use client";

import { useEffect, useRef, useState } from "react";

// Número que sube desde cero al cargar; sin animación si el usuario pidió menos movimiento.
export function Contador({ valor, soles }: { valor: number; soles?: boolean }) {
  const [n, setN] = useState(0);
  const primera = useRef(true);

  useEffect(() => {
    if (!primera.current || matchMedia("(prefers-reduced-motion: reduce)").matches || valor === 0) {
      setN(valor);
      return;
    }
    primera.current = false;
    const dur = 700;
    const t0 = performance.now();
    let raf = 0;
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(valor * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor]);

  const texto = soles
    ? "S/ " + n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(n).toLocaleString("es-PE");
  return <span className="tnum">{texto}</span>;
}
