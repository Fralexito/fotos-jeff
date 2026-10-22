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
  pendiente: ["Pendiente", "b-warn"],
  procesado: ["Procesado", "b-info"],
  en_impresion: ["En impresión", "b-info"],
  entregado: ["Entregado", "b-good"],
  anulado: ["Anulado", "b-neutral"],
};

// Fecha de hoy en Lima como YYYY-MM-DD.
export function hoyLima() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

// Fecha sin hora (YYYY-MM-DD) en formato corto: "24 oct."
export function dia(d: string | null | undefined) {
  return d ? fecha(d + "T12:00:00-05:00") : "";
}

// Enlace de WhatsApp con mensaje listo; acepta números peruanos de 9 dígitos.
export function whatsapp(telefono: string | null | undefined, mensaje = "") {
  const n = (telefono ?? "").replace(/\D/g, "");
  if (n.length < 9) return null;
  const completo = n.length === 9 ? "51" + n : n;
  return `https://wa.me/${completo}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}

export const ETAPA: Record<string, [string, string]> = {
  nuevo: ["Nuevo", "b-neutral"],
  contactado: ["Contactado", "b-info"],
  reunion: ["Reunión", "b-info"],
  propuesta: ["Propuesta", "b-warn"],
  ganado: ["Ganado", "b-good"],
  perdido: ["Perdido", "b-bad"],
};

export const CARGO: Record<string, string> = {
  director: "Director(a)",
  subdirector: "Subdirector(a)",
  docente: "Docente / tutor",
  comite: "Comité / APAFA",
  padre: "Padre o madre",
  otro: "Otro",
};

export const TIPO_ACTIVIDAD: Record<string, string> = {
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  visita: "Visita",
  reunion: "Reunión",
  nota: "Nota",
};

export const CATEGORIAS_GASTO = ["Materiales", "Impresión", "Transporte", "Sueldos", "Alquiler", "Servicios", "Equipos", "Otros"];
export const CATEGORIAS_INGRESO = ["Fondo inicial", "Venta suelta", "Otros"];

// Niveles del catálogo, en el orden en que se muestran. Sin nivel = sirve para todos.
export const NIVELES: [string, string][] = [["inicial", "Inicial"], ["primaria", "Primaria"], ["secundaria", "Secundaria"], ["superior", "Superior"]];
