import { Check, Download, Hourglass, ImageOff, Palette, RotateCcw, X } from "lucide-react";
import { requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Empty, PageHeader, Tabs } from "@/components/ui";
import { salon } from "@/lib/datos";
import { revisarFotos, guardarFondo } from "../acciones-fotos";
import { Refrescar } from "@/components/refrescar";
import { ElegirCampana, SubirFotos } from "./subir";

const VISTAS = {
  revisar: { label: "Por revisar", estados: ["procesada", "excepcion"] },
  cola: { label: "En edición", estados: ["subida", "procesando"] },
  aprobadas: { label: "Aprobadas", estados: ["aprobada"] },
  rechazadas: { label: "Rechazadas", estados: ["rechazada"] },
} as const;
type Vista = keyof typeof VISTAS;

const SEMAFORO: Record<string, [string, string]> = {
  verde: ["Lista", "b-good"], amarillo: ["Revisar", "b-warn"], rojo: ["Problema", "b-bad"],
};

type Foto = {
  id: string; estado: string; producto: string; ruta_vista: string | null; motivo_excepcion: string | null;
  qa: { semaforo?: string; alertas?: string[]; salidas?: Record<string, string> } | null;
  alumnos: { codigo: string; nombres: string; apellidos: string; grado: string | null; seccion: string | null } | null;
};

// Un formulario por botón: la acción va en un campo oculto y no depende de qué botón envió el formulario.
function AccionFoto({ id, volver, accion, className, titulo, children }: {
  id: string; volver: string; accion: string; className: string; titulo?: string; children: React.ReactNode;
}) {
  return (
    <form action={revisarFotos}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="volver" value={volver} />
      <input type="hidden" name="accion" value={accion} />
      <button className={className} type="submit" aria-label={titulo} title={titulo}>{children}</button>
    </form>
  );
}

const aHex = (rgb: string) => "#" + rgb.split(",").map((n) => Number(n).toString(16).padStart(2, "0")).join("");

export default async function Fotos({ searchParams }: { searchParams: Promise<{ campana?: string; ver?: string; ok?: string; error?: string }> }) {
  const { campana: pedida, ver: pedidaVista, ...aviso } = await searchParams;
  const { supabase } = await requirePerfil();

  const { data: campanas } = await supabase
    .from("campanas")
    .select("id, nombre, anio, estado, fondo_rgb, colegios(nombre)")
    .order("creado_en", { ascending: false });
  const lista = (campanas ?? []) as unknown as { id: string; nombre: string; anio: number; estado: string; fondo_rgb: string | null; colegios: { nombre: string } | null }[];
  const campana = lista.find((c) => c.id === pedida) ?? lista.find((c) => c.estado !== "cerrada") ?? lista[0];

  if (!campana) {
    return (
      <>
        <PageHeader modulo="fotos" title="Fotos" />
        <div className="card"><Empty icon={ImageOff} title="Primero crea una campaña">Las fotos se suben dentro de una campaña de un colegio.</Empty></div>
      </>
    );
  }

  const ver: Vista = pedidaVista && pedidaVista in VISTAS ? (pedidaVista as Vista) : "revisar";
  const cuenta = (estados: readonly string[]) =>
    supabase.from("fotos").select("id", { count: "exact", head: true }).eq("campana_id", campana.id).in("estado", estados as string[]);

  const [conteos, { data: fotosData }, { data: alumnos }, { data: productos }] = await Promise.all([
    Promise.all((Object.keys(VISTAS) as Vista[]).map((k) => cuenta(VISTAS[k].estados).then((r) => [k, r.count ?? 0] as const))),
    supabase
      .from("fotos")
      .select("id, estado, producto, ruta_vista, motivo_excepcion, qa, alumnos(codigo, nombres, apellidos, grado, seccion)")
      .eq("campana_id", campana.id)
      .in("estado", VISTAS[ver].estados as unknown as string[])
      .order("estado")
      .order("creado_en", { ascending: false })
      .limit(120),
    supabase.from("alumnos").select("id, codigo").eq("campana_id", campana.id),
    supabase.from("productos").select("codigo").eq("es_combo", false).eq("activo", true),
  ]);
  const n = Object.fromEntries(conteos) as Record<Vista, number>;
  const fotos = (fotosData ?? []) as unknown as Foto[];

  // Problemas primero, luego las que hay que mirar, al final las verdes.
  const peso = (f: Foto) => ({ rojo: 0, amarillo: 1, verde: 2 })[f.qa?.semaforo ?? ""] ?? (f.estado === "excepcion" ? 0 : 3);
  fotos.sort((a, b) => peso(a) - peso(b));

  // Enlaces firmados (1 hora) para ver y descargar desde el bucket privado.
  const rutas = [...new Set(fotos.flatMap((f) => [f.ruta_vista, ...Object.values(f.qa?.salidas ?? {})]).filter((r): r is string => !!r))];
  const firmadas = new Map<string, string>();
  if (rutas.length) {
    const { data } = await supabase.storage.from("procesadas").createSignedUrls(rutas, 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) firmadas.set(d.path, d.signedUrl);
  }

  const medidas = (productos ?? []).map((p) => p.codigo).filter((c) => /^\d+x\d+$|^carnet$/i.test(c));
  const opciones = medidas.length ? [...new Set(medidas)] : ["15x21", "20x30", "carnet"];
  const verdes = fotos.filter((f) => f.estado === "procesada" && f.qa?.semaforo === "verde").map((f) => f.id);
  const volver = `/panel/fotos?campana=${campana.id}&ver=${ver}`;
  const fondo = campana.fondo_rgb ?? "107,201,237";

  return (
    <>
      <Refrescar activo={n.cola > 0} />
      <PageHeader
        modulo="fotos"
        title="Fotos"
        subtitle="Sube las fotos; el motor del estudio las edita solo. Aquí apruebas las que quedaron bien."
        actions={
          <Modal label="Color de fondo" title="Color del fondo liso" icon={<Palette className="i" />} variant="secondary">
            <form action={guardarFondo} className="form">
              <input type="hidden" name="campana_id" value={campana.id} />
              <input type="hidden" name="volver" value={volver} />
              <p className="muted-text">El motor pinta este color detrás de cada alumno en <b>{campana.nombre}</b>. Solo cambia las fotos que se procesen desde ahora.</p>
              <label className="field fondo-campo">
                Color
                <input type="color" name="color" defaultValue={aHex(fondo)} />
              </label>
              <div className="form-foot"><button className="btn" type="submit">Guardar color</button></div>
            </form>
          </Modal>
        }
      />
      <Aviso {...aviso} />

      <div className="fotos-top">
        <div className="card fotos-campana">
          <span className="muted-text">Campaña</span>
          <ElegirCampana
            actual={campana.id}
            ver={ver}
            campanas={lista.map((c) => ({ id: c.id, texto: `${c.colegios?.nombre ?? ""} · ${c.nombre}` }))}
          />
          <div className="fondo-muestra"><span style={{ background: `rgb(${fondo})` }} /> Fondo de esta campaña</div>
        </div>
        <div className="card fotos-subir">
          <SubirFotos campanaId={campana.id} alumnos={alumnos ?? []} medidas={opciones} />
        </div>
      </div>

      <Tabs items={(Object.keys(VISTAS) as Vista[]).map((k) => ({ href: `/panel/fotos?campana=${campana.id}&ver=${k}`, label: VISTAS[k].label, count: n[k], active: k === ver }))} />

      {ver === "revisar" && verdes.length > 1 && (
        <form action={revisarFotos} className="fotos-masivo">
          <input type="hidden" name="accion" value="aprobar" />
          <input type="hidden" name="volver" value={volver} />
          {verdes.map((id) => <input key={id} type="hidden" name="id" value={id} />)}
          <span><b>{verdes.length}</b> fotos salieron en verde.</span>
          <button className="btn sm" type="submit"><Check className="i" /> Aprobar todas las verdes</button>
        </form>
      )}

      {fotos.length === 0 ? (
        <div className="card">
          <Empty icon={ver === "cola" ? Hourglass : ImageOff} title={ver === "revisar" ? "Nada por revisar" : ver === "cola" ? "No hay fotos en edición" : "Sin fotos aquí"}>
            {ver === "revisar" ? "Cuando el motor termine una foto, aparece aquí." : null}
          </Empty>
        </div>
      ) : (
        <div className="fotos-grid">
          {fotos.map((f) => {
            const [sem, cls] = SEMAFORO[f.qa?.semaforo ?? ""] ?? (f.estado === "excepcion" ? ["Problema", "b-bad"] : ["", ""]);
            const alertas = [...(f.qa?.alertas ?? []), ...(f.estado === "excepcion" && f.motivo_excepcion && !f.qa?.alertas?.length ? [f.motivo_excepcion] : [])];
            const vista = f.ruta_vista ? firmadas.get(f.ruta_vista) : null;
            const a = f.alumnos;
            return (
              <article key={f.id} className={`foto foto-${f.qa?.semaforo ?? f.estado}`}>
                <div className="foto-img">
                  {vista ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vista} alt={a ? `${a.nombres} ${a.apellidos}` : "Foto"} loading="lazy" />
                  ) : (
                    <div className="foto-espera">
                      <Hourglass className="i" />
                      {f.estado === "subida" ? "En cola" : f.estado === "procesando" ? "Editando…" : "Sin vista previa"}
                    </div>
                  )}
                  {sem && <span className={`badge ${cls}`}>{sem}</span>}
                </div>
                <div className="foto-info">
                  <b>{a ? `${a.apellidos}, ${a.nombres}` : "Sin alumno asignado"}</b>
                  <small>{a ? `${a.codigo} · ${salon(a)} · ` : ""}{f.producto.split(",").join(" + ")}</small>
                  {alertas.length > 0 && <ul className="foto-alertas">{alertas.map((t, i) => <li key={i}>{t}</li>)}</ul>}
                  {f.qa?.salidas && Object.keys(f.qa.salidas).length > 0 && (
                    <div className="foto-salidas">
                      {Object.entries(f.qa.salidas).map(([medida, ruta]) =>
                        firmadas.get(ruta) ? (
                          <a key={medida} className="btn ghost sm" href={firmadas.get(ruta)} target="_blank" rel="noopener noreferrer"><Download className="i" /> {medida}</a>
                        ) : null,
                      )}
                    </div>
                  )}
                </div>
                {f.estado !== "subida" && f.estado !== "procesando" && (
                  <div className="foto-acciones">
                    {f.estado !== "aprobada" && (
                      <AccionFoto id={f.id} volver={volver} accion="aprobar" className="btn sm"><Check className="i" /> Aprobar</AccionFoto>
                    )}
                    {f.estado !== "rechazada" && (
                      <AccionFoto id={f.id} volver={volver} accion="rechazar" className="btn secondary sm" titulo="Rechazar"><X className="i" /></AccionFoto>
                    )}
                    <AccionFoto id={f.id} volver={volver} accion="reprocesar" className="btn ghost sm" titulo="Volver a editar"><RotateCcw className="i" /></AccionFoto>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
