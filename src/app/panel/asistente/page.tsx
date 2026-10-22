import { PERMISOS, requirePerfil } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Chat } from "./chat";

export default async function Asistente() {
  const { perfil } = await requirePerfil(PERMISOS.reportes);
  return (
    <>
      <PageHeader modulo="asistente" title="Asistente IA" subtitle="Pregunta en tus palabras y te responde con los datos del panel." />
      {!process.env.ANTHROPIC_API_KEY && (
        <div className="notice warn">El asistente aún no está conectado. Falta poner la clave de IA en la configuración del sitio.</div>
      )}
      <Chat nombre={perfil.nombre.split(" ")[0]} />
    </>
  );
}
