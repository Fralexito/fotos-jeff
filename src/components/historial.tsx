import { MessageCircle, MapPin, Phone, StickyNote, Users } from "lucide-react";
import { TIPO_ACTIVIDAD } from "@/lib/formato";
import { registrarActividad } from "@/app/panel/acciones-erp";

const ICONO = { llamada: Phone, whatsapp: MessageCircle, visita: MapPin, reunion: Users, nota: StickyNote };

type Actividad = { id: string; tipo: string; detalle: string; creado_en: string; perfiles: unknown };

const cuando = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Lima" }).format(new Date(iso));

// Línea de tiempo de llamadas, visitas y notas.
export function Historial({ items }: { items: Actividad[] }) {
  if (items.length === 0) return <p className="muted-text" style={{ padding: "0 20px 20px", margin: 0 }}>Todavía no hay nada anotado.</p>;
  return (
    <ol className="timeline">
      {items.map((a) => {
        const Icono = ICONO[a.tipo as keyof typeof ICONO] ?? StickyNote;
        const quien = (a.perfiles as { nombre: string } | null)?.nombre;
        return (
          <li key={a.id}>
            <span className="tl-ico"><Icono className="i" /></span>
            <div>
              <p>{a.detalle}</p>
              <small>{TIPO_ACTIVIDAD[a.tipo]} · {cuando(a.creado_en)}{quien && ` · ${quien}`}</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function FormActividad({ oportunidadId, colegioId, volver }: { oportunidadId?: string; colegioId?: string | null; volver: string }) {
  return (
    <form action={registrarActividad} className="activity-form">
      {oportunidadId && <input type="hidden" name="oportunidad_id" value={oportunidadId} />}
      {colegioId && <input type="hidden" name="colegio_id" value={colegioId} />}
      <input type="hidden" name="volver" value={volver} />
      <textarea name="detalle" required placeholder="¿Qué pasó? Ej.: La directora aceptó, quiere la propuesta por escrito." />
      <div className="activity-foot">
        <div className="chips">
          {Object.entries(TIPO_ACTIVIDAD).map(([v, t], i) => (
            <label key={v}><input type="radio" name="tipo" value={v} defaultChecked={i === 0} /><span>{t}</span></label>
          ))}
        </div>
        <button className="btn sm" type="submit">Anotar</button>
      </div>
    </form>
  );
}
