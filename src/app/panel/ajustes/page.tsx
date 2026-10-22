import { requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Avatar, PageHeader } from "@/components/ui";
import { guardarMiPerfil } from "../actions";
import { Apariencia } from "./apariencia";

const NOMBRE_ROL = { dueno: "Dueño", operador: "Operador", fotografo: "Fotógrafo" } as const;
const QUE_HACE = {
  dueno: "Ve todo: dinero, catálogo y equipo.",
  operador: "Cobra, registra pedidos y maneja colegios.",
  fotografo: "Ve colegios y listas de alumnos.",
} as const;

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const aviso = await searchParams;
  const { supabase, perfil } = await requirePerfil();
  const equipo =
    perfil.rol === "dueno"
      ? (await supabase.from("perfiles").select("id, nombre, telefono, rol").order("nombre")).data ?? []
      : [];

  return (
    <>
      <PageHeader title="Ajustes" subtitle="Personaliza el panel a tu gusto y revisa tus datos." />
      <Aviso {...aviso} />

      <Apariencia inicial={perfil.preferencias} />

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Mi perfil</h2>
              <p>Así te verá el resto del equipo.</p>
            </div>
          </div>
          <form action={guardarMiPerfil} className="card-body form">
            <div className="fields">
              <label className="field">Nombre<input name="nombre" defaultValue={perfil.nombre} required /></label>
              <label className="field">Celular<input name="telefono" type="tel" defaultValue={perfil.telefono ?? ""} placeholder="9xx xxx xxx" /></label>
            </div>
            <div className="form-foot"><button className="btn" type="submit">Guardar perfil</button></div>
          </form>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Tu rol</h2>
              <p>Define qué partes del panel ves.</p>
            </div>
          </div>
          <div className="card-body">
            <span className="badge b-info">{NOMBRE_ROL[perfil.rol]}</span>
            <p className="muted-text">{QUE_HACE[perfil.rol]}</p>
          </div>
        </div>
      </div>

      {equipo.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Equipo</h2>
              <p>Personas con acceso al panel. Para sumar a alguien nuevo, pídelo y se crea su cuenta.</p>
            </div>
            <span className="muted-text">{equipo.length} {equipo.length === 1 ? "persona" : "personas"}</span>
          </div>
          <div className="list">
            {equipo.map((m) => (
              <div className="item" key={m.id}>
                <div className="main">
                  <Avatar name={m.nombre} />
                  <div>
                    <div className="title">{m.nombre}{m.id === perfil.id && " (tú)"}</div>
                    <div className="meta">{QUE_HACE[m.rol as keyof typeof QUE_HACE]}{m.telefono && ` · ${m.telefono}`}</div>
                  </div>
                </div>
                <div className="end">
                  <span className={`badge ${m.rol === "dueno" ? "b-good" : m.rol === "operador" ? "b-info" : "b-neutral"}`}>
                    {NOMBRE_ROL[m.rol as keyof typeof NOMBRE_ROL]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
