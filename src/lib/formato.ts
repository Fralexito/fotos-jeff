const soles = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 });

export function S(monto: number | string | null | undefined) {
  return soles.format(Number(monto ?? 0));
}

// Inicio del día de hoy en Lima (UTC-5, sin horario de verano), en ISO para filtrar por fecha.
export function inicioDeHoyLima() {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  return `${hoy}T00:00:00-05:00`;
}

export function fecha(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", timeZone: "America/Lima" }).format(new Date(iso));
}

export function saludo() {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Lima" }).format(new Date()));
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export const TIPO_CAMPANA: Record<string, string> = {
  promocion: "Promoción",
  graduacion: "Graduación",
  carnet: "Carnets",
  otro: "Otro",
};

export const ESTADO_PEDIDO: Record<string, [string, string]> = {
  pendiente: ["Pendiente", "p-warn"],
  procesado: ["Procesado", "p-info"],
  en_impresion: ["En impresión", "p-info"],
  entregado: ["Entregado", "p-good"],
  anulado: ["Anulado", "p-bad"],
};
