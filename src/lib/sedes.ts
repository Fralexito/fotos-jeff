// Sedes del estudio. La lista con encargados vive en la tabla sedes; aquí solo los nombres.
export const SEDES: [string, string][] = [["nauta", "Nauta"], ["iquitos", "Iquitos (Liz)"], ["iquitos2", "Iquitos (Dan)"]];
export const NOMBRE_SEDE: Record<string, string> = Object.fromEntries(SEDES);

// Dónde queda el colegio: en la ciudad o en las zonas cercanas.
export const ZONAS: [string, string][] = [["ciudad", "En la ciudad"], ["carretera", "Carretera"], ["rio", "Pueblo por el río"]];
export const NOMBRE_ZONA: Record<string, string> = Object.fromEntries(ZONAS);

// La sede elegida arriba ("todas" = sin filtro).
export const filtroSede = (sede: string) => (sede === "todas" ? null : sede);

// Sede válida o Nauta por defecto.
export const sedeValida = (v: string | null | undefined) => (SEDES.some(([id]) => id === v) ? v! : "nauta");
