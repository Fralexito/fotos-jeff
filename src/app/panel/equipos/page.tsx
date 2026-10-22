import { Aperture, Camera, CircleAlert, Laptop, Lightbulb, Package, Pencil, Plus, Printer, Wrench, Zap, type LucideIcon } from "lucide-react";
import { requirePerfil } from "@/lib/auth";
import { fecha, hoyLima } from "@/lib/formato";
import { NOMBRE_SEDE, SEDES, filtroSede } from "@/lib/sedes";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Empty, PageHeader } from "@/components/ui";
import { estadoEquipo, guardarEquipo } from "../acciones-erp";
import { SimpleLista, SimpleTitulo } from "@/components/simple";

const TIPOS: [string, string, string, LucideIcon][] = [
  ["camara", "Cámaras", "Cámara", Camera], ["lente", "Lentes", "Lente", Aperture], ["flash", "Flashes", "Flash", Zap],
  ["iluminacion", "Luces", "Luz o softbox", Lightbulb], ["fondo", "Fondos", "Fondo", Package], ["impresora", "Impresoras", "Impresora", Printer],
  ["computadora", "Computadoras", "Computadora", Laptop], ["otro", "Otros", "Otro", Package],
];
const ESTADOS: Record<string, [string, string]> = {
  disponible: ["Disponible", "b-good"], en_uso: ["En uso", "b-info"], mantenimiento: ["En mantenimiento", "b-warn"], baja: ["De baja", "b-bad"],
};

type Equipo = {
  id: string; nombre: string; tipo: string; marca_modelo: string | null; serie: string | null; sede: string; estado: string;
  asignado_a: string | null; proximo_mantenimiento: string | null; notas: string | null;
};

function FormEquipo({ e, sede }: { e?: Equipo; sede: string }) {
  return (
    <form action={guardarEquipo} className="form">
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="fields">
        <label className="field" style={{ gridColumn: "1 / -1" }}>Nombre<input name="nombre" required defaultValue={e?.nombre} placeholder="Cámara principal" /></label>
        <label className="field">Tipo<select name="tipo" defaultValue={e?.tipo ?? "camara"}>{TIPOS.map(([v, , uno]) => <option key={v} value={v}>{uno}</option>)}</select></label>
        <label className="field">Marca y modelo<input name="marca_modelo" defaultValue={e?.marca_modelo ?? ""} placeholder="Canon EOS 90D" /></label>
        <label className="field">N.º de serie<input name="serie" defaultValue={e?.serie ?? ""} /></label>
        <label className="field">Sede<select name="sede" defaultValue={e?.sede ?? sede}>{SEDES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <label className="field">Lo tiene<input name="asignado_a" defaultValue={e?.asignado_a ?? ""} placeholder="Dan, Liz…" /></label>
        <label className="field">Próximo mantenimiento<input type="date" name="proximo_mantenimiento" defaultValue={e?.proximo_mantenimiento ?? ""} /></label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>Notas<input name="notas" defaultValue={e?.notas ?? ""} placeholder="Batería extra, sensor por limpiar…" /></label>
      </div>
      <div className="form-foot"><button className="btn" type="submit">Guardar equipo</button></div>
    </form>
  );
}

export default async function Equipos({ searchParams }: { searchParams: Promise<{ nuevo?: string; ok?: string; error?: string }> }) {
  const { nuevo, ...aviso } = await searchParams;
  const { supabase, perfil } = await requirePerfil();
  const sede = filtroSede(perfil.preferencias.sede);
  let q = supabase.from("equipos").select("id, nombre, tipo, marca_modelo, serie, sede, estado, asignado_a, proximo_mantenimiento, notas").order("nombre");
  if (sede) q = q.eq("sede", sede);
  const { data } = await q.returns<Equipo[]>();
  const equipos = data ?? [];
  const activos = equipos.filter((e) => e.estado !== "baja");
  const hoy = hoyLima();
  const en7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const porMantener = activos.filter((e) => e.proximo_mantenimiento && e.proximo_mantenimiento <= en7);
  const sedeForm = sede ?? "nauta";

  // Vista sencilla: qué equipo hay, dónde está y si está bien.
  if (perfil.preferencias.vista === "sencilla") {
    return (
      <div className="simple">
        <SimpleTitulo titulo="Cámaras y equipos" sub={sede ? `Sede ${NOMBRE_SEDE[sede]}` : "Todas las sedes"} />
        <Aviso {...aviso} />
        <SimpleLista
          vacio="Todavía no hay equipos anotados."
          filas={activos.map((e) => {
            const toca = porMantener.includes(e);
            return {
              key: e.id, titulo: e.nombre,
              sub: [NOMBRE_SEDE[e.sede], e.asignado_a && `lo tiene ${e.asignado_a}`, toca && "toca mantenimiento"].filter(Boolean).join(" · "),
              valor: (ESTADOS[e.estado] ?? [e.estado])[0], tono: toca || e.estado === "mantenimiento" ? "debe" as const : "suave" as const,
            };
          })}
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        modulo="equipos"
        title="Cámaras y equipos"
        subtitle="Qué equipo hay en cada sede, quién lo tiene y cuándo toca mantenimiento."
        actions={<Modal abrir={nuevo === "1"} label="Nuevo equipo" title="Nuevo equipo" icon={<Plus className="i" />}><FormEquipo sede={sedeForm} /></Modal>}
      />
      <Aviso {...aviso} />

      {porMantener.length > 0 && (
        <div className="notice warn">
          <CircleAlert className="i" />
          <span><b>Toca mantenimiento:</b> {porMantener.map((e) => `${e.nombre} (${e.proximo_mantenimiento! < hoy ? "vencido" : fecha(e.proximo_mantenimiento + "T12:00:00-05:00")})`).join(" · ")}</span>
        </div>
      )}

      <div className="kpis detalle">
        {(["disponible", "en_uso", "mantenimiento"] as const).map((k) => (
          <div className="kpi" key={k}>
            <div className="top">{ESTADOS[k][0]}</div>
            <div className="val">{activos.filter((e) => e.estado === k).length}</div>
            <div className="sub">de {activos.length} equipos</div>
          </div>
        ))}
      </div>

      {equipos.length === 0 ? (
        <div className="card"><Empty icon={Camera} title="Aún no hay equipos">Agrega las cámaras, flashes, luces e impresoras de cada sede.</Empty></div>
      ) : (
        TIPOS.map(([tipo, titulo, , Icono]) => {
          const lista = equipos.filter((e) => e.tipo === tipo);
          if (lista.length === 0) return null;
          return (
            <div className="card" key={tipo}>
              <div className="card-head"><div><h2 className="con-ico"><Icono className="i" /> {titulo}</h2><p>{lista.length} {lista.length === 1 ? "equipo" : "equipos"}</p></div></div>
              <div className="list">
                {lista.map((e) => {
                  const [estadoTxt, estadoCls] = ESTADOS[e.estado] ?? ESTADOS.disponible;
                  const vence = e.proximo_mantenimiento;
                  return (
                    <div className={`item equipo${e.estado === "baja" ? " apagado" : ""}`} key={e.id}>
                      <div className="main">
                        <span className="dot-ico"><Icono className="i" /></span>
                        <div>
                          <div className="title">{e.nombre} <span className={`badge ${estadoCls}`}>{estadoTxt}</span></div>
                          <div className="meta">
                            {[e.marca_modelo, e.serie && `Serie ${e.serie}`, NOMBRE_SEDE[e.sede], e.asignado_a && `Lo tiene ${e.asignado_a}`].filter(Boolean).join(" · ")}
                          </div>
                          {(vence || e.notas) && (
                            <div className="meta">
                              {vence && <span className={vence < hoy ? "txt-bad" : vence <= en7 ? "txt-warn" : ""}><Wrench className="i" /> Mantenimiento {fecha(vence + "T12:00:00-05:00")}</span>}
                              {vence && e.notas && " · "}{e.notas}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="end equipo-acciones">
                        <form action={estadoEquipo} className="seg">
                          <input type="hidden" name="id" value={e.id} />
                          {(["disponible", "en_uso", "mantenimiento"] as const).filter((k) => k !== e.estado).map((k) => (
                            <button key={k} name="estado" value={k}>{ESTADOS[k][0].replace("En mantenimiento", "Mantenimiento")}</button>
                          ))}
                        </form>
                        <Modal variant="secondary" label="Editar" title={`Editar ${e.nombre}`} icon={<Pencil className="i" />}>
                          <FormEquipo e={e} sede={sedeForm} />
                          {e.estado !== "baja" && (
                            <form action={estadoEquipo} className="form-foot">
                              <input type="hidden" name="id" value={e.id} />
                              <button className="btn secondary" name="estado" value="baja">Dar de baja</button>
                            </form>
                          )}
                        </Modal>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
