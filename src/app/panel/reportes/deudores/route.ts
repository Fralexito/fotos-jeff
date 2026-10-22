import { PERMISOS, requirePerfil } from "@/lib/auth";
import { deudores } from "@/lib/reportes";
import { filtroSede } from "@/lib/sedes";

// Lista de deudores en CSV para abrir en Excel.
export async function GET() {
  const { supabase, perfil } = await requirePerfil(PERMISOS.reportes);
  const filas = await deudores(supabase, filtroSede(perfil.preferencias.sede));
  const celda = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    ["Pedido", "Alumno", "Colegio", "Campaña", "Salón", "Celular apoderado", "Total", "Pagado", "Saldo"].map(celda).join(";"),
    ...filas.map((d) => [d.numero, d.alumno, d.colegio, d.campana, d.salon, d.telefono, d.total.toFixed(2), d.pagado.toFixed(2), d.saldo.toFixed(2)].map(celda).join(";")),
  ].join("\r\n");
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="deudores-fotos-jefferson.csv"`,
    },
  });
}
