// Ajustes visuales de cada persona, guardados en perfiles.preferencias.
export const OPCIONES = {
  vista: [
    { valor: "sencilla", texto: "Sencilla" },
    { valor: "completa", texto: "Completa" },
  ],
  color: [
    { valor: "turquesa", texto: "Turquesa", muestra: "#2a97a8" },
    { valor: "azul", texto: "Azul", muestra: "#3a6fd8" },
    { valor: "verde", texto: "Verde", muestra: "#12806a" },
    { valor: "violeta", texto: "Violeta", muestra: "#6c5ccf" },
    { valor: "coral", texto: "Coral", muestra: "#d0654c" },
    { valor: "grafito", texto: "Grafito", muestra: "#4b5a66" },
  ],
  tema: [
    { valor: "claro", texto: "Claro" },
    { valor: "oscuro", texto: "Oscuro" },
  ],
  letra: [
    { valor: "normal", texto: "Normal" },
    { valor: "grande", texto: "Grande" },
    { valor: "muy-grande", texto: "Muy grande" },
  ],
  densidad: [
    { valor: "comoda", texto: "Cómoda" },
    { valor: "compacta", texto: "Compacta" },
  ],
  sede: [
    { valor: "todas", texto: "Todas las sedes" },
    { valor: "nauta", texto: "Nauta" },
    { valor: "iquitos", texto: "Iquitos" },
  ],
} as const;

export type Clave = keyof typeof OPCIONES;
export type Preferencias = { [K in Clave]: (typeof OPCIONES)[K][number]["valor"] };

export const PREDETERMINADAS: Preferencias = { vista: "sencilla", color: "turquesa", tema: "claro", letra: "normal", densidad: "comoda", sede: "todas" };

// Toma lo guardado y descarta valores desconocidos.
export function leerPreferencias(guardado: unknown): Preferencias {
  const g = (guardado && typeof guardado === "object" ? guardado : {}) as Record<string, unknown>;
  const p = { ...PREDETERMINADAS };
  for (const k of Object.keys(OPCIONES) as Clave[]) {
    if (OPCIONES[k].some((o) => o.valor === g[k])) (p as Record<Clave, unknown>)[k] = g[k];
  }
  return p;
}
