import { PERMISOS, requirePerfil } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { deudores } from "@/lib/reportes";
import { filtroSede, NOMBRE_SEDE } from "@/lib/sedes";
import { Lote, type Familia } from "./lote";

// Cobrar por WhatsApp en lote: un mensaje por apoderado, con todos sus pedidos pendientes sumados.
export default async function CobrarWhatsApp() {
  const { supabase, perfil } = await requirePerfil(PERMISOS.cobros);
  const sede = filtroSede(perfil.preferencias.sede);
  const lista = await deudores(supabase, sede);

  const familias = new Map<string, Familia>();
  for (const d of lista) {
    const tel = (d.telefono ?? "").replace(/\D/g, "");
    const clave = tel.length >= 9 ? tel.slice(-9) : `sin-${d.id}`;
    const f = familias.get(clave) ?? { clave, telefono: tel.length >= 9 ? tel : null, colegios: [], pedidos: [], saldo: 0 };
    f.pedidos.push({ alumnoId: d.alumnoId, numero: d.numero, alumno: d.alumno, saldo: d.saldo, salon: d.salon });
    if (!f.colegios.includes(d.colegio)) f.colegios.push(d.colegio);
    f.saldo += d.saldo;
    familias.set(clave, f);
  }

  return (
    <>
      <PageHeader
        modulo="cobros"
        title="Cobrar por WhatsApp"
        crumbs={[{ href: "/panel/cobros", label: "Cobros" }]}
        subtitle={`Elige a quiénes escribir y envía uno por uno. Un mensaje por apoderado, aunque tenga varios hijos.${sede ? ` Solo sede ${NOMBRE_SEDE[sede]}.` : ""}`}
      />
      <Lote familias={[...familias.values()].sort((a, b) => b.saldo - a.saldo)} />
    </>
  );
}
