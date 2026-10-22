import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, HandCoins, ImageOff, Pencil, Phone, Receipt, ShoppingBag, Users } from "lucide-react";
import { puede, requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Modal } from "@/components/modal";
import { Avatar, Empty, PageHeader, WhatsApp } from "@/components/ui";
import { ESTADO_PEDIDO, S, TIPO_CAMPANA, fecha, whatsapp } from "@/lib/formato";
import { salon } from "@/lib/datos";
import { NOMBRE_SEDE } from "@/lib/sedes";
import { editarAlumno } from "../../actions";

type Alumno = {
  id: string; codigo: string; nombres: string; apellidos: string; grado: string | null; seccion: string | null; dni: string | null;
  apoderado_nombre: string | null; apoderado_telefono: string | null; campana_id: string;
  campanas: { id: string; nombre: string; anio: number; tipo: string; colegios: { id: string; nombre: string; sede: string } | null } | null;
};
type Pedido = {
  id: string; numero: number; estado: string; total: number; creado_en: string; entregado_en: string | null; notas: string | null;
  pedido_items: { cantidad: number; precio_unitario: number; productos: { nombre: string } | null }[];
};
type Pago = { id: string; pedido_id: string; monto: number; metodo: string; estado: string; operacion: string | null; creado_en: string };
type Foto = { id: string; estado: string; producto: string; ruta_vista: string | null; qa: { semaforo?: string } | null };

const METODO: Record<string, string> = { efectivo: "Efectivo", yape: "Yape", plin: "Plin", transferencia: "Transferencia", tarjeta: "Tarjeta" };
const ESTADO_FOTO: Record<string, [string, string]> = {
  subida: ["En cola", "b-neutral"], procesando: ["Editando", "b-info"], procesada: ["Por revisar", "b-warn"],
  excepcion: ["Problema", "b-bad"], aprobada: ["Aprobada", "b-good"], rechazada: ["Rechazada", "b-neutral"],
};

// Todo sobre un alumno en una sola página: datos, fotos, pedidos, pagos y hermanos.
export default async function FichaAlumno({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const aviso = await searchParams;
  const { supabase, perfil } = await requirePerfil();
  const veDinero = puede(perfil, "cobros");

  const { data: a } = await supabase
    .from("alumnos")
    .select("id, codigo, nombres, apellidos, grado, seccion, dni, apoderado_nombre, apoderado_telefono, campana_id, campanas(id, nombre, anio, tipo, colegios(id, nombre, sede))")
    .eq("id", id)
    .returns<Alumno[]>()
    .maybeSingle();
  if (!a) notFound();

  const tel = (a.apoderado_telefono ?? "").replace(/\D/g, "");
  const [{ data: pedidosData }, { data: saldos }, { data: fotosData }, hermanos] = await Promise.all([
    supabase
      .from("pedidos")
      .select("id, numero, estado, total, creado_en, entregado_en, notas, pedido_items(cantidad, precio_unitario, productos(nombre))")
      .eq("alumno_id", id)
      .order("numero", { ascending: false })
      .returns<Pedido[]>(),
    supabase.from("pedidos_saldo").select("id, pagado, saldo").eq("alumno_id", id),
    supabase.from("fotos").select("id, estado, producto, ruta_vista, qa").eq("alumno_id", id).order("creado_en", { ascending: false }).returns<Foto[]>(),
    tel.length >= 9
      ? supabase
          .from("alumnos")
          .select("id, nombres, apellidos, grado, seccion, campanas(nombre, colegios(nombre))")
          .ilike("apoderado_telefono", `%${tel.slice(-9)}%`)
          .neq("id", id)
          .limit(10)
          .returns<{ id: string; nombres: string; apellidos: string; grado: string | null; seccion: string | null; campanas: { nombre: string; colegios: { nombre: string } | null } | null }[]>()
      : { data: [] },
  ]);
  const pedidos = pedidosData ?? [];
  const saldo = new Map((saldos ?? []).map((s) => [s.id, { pagado: Number(s.pagado), saldo: Number(s.saldo) }]));
  const { data: pagosData } = veDinero && pedidos.length
    ? await supabase.from("pagos").select("id, pedido_id, monto, metodo, estado, operacion, creado_en").in("pedido_id", pedidos.map((p) => p.id)).order("creado_en", { ascending: false }).returns<Pago[]>()
    : { data: [] as Pago[] };
  const numero = new Map(pedidos.map((p) => [p.id, p.numero]));

  const fotos = fotosData ?? [];
  const rutas = fotos.map((f) => f.ruta_vista).filter((r): r is string => !!r);
  const firmadas = new Map<string, string>();
  if (rutas.length) {
    const { data } = await supabase.storage.from("procesadas").createSignedUrls(rutas, 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) firmadas.set(d.path, d.signedUrl);
  }

  const vigentes = pedidos.filter((p) => p.estado !== "anulado");
  const total = vigentes.reduce((s, p) => s + Number(p.total), 0);
  const pagado = vigentes.reduce((s, p) => s + (saldo.get(p.id)?.pagado ?? 0), 0);
  const debe = vigentes.reduce((s, p) => s + (saldo.get(p.id)?.saldo ?? 0), 0);
  const k = a.campanas;
  const nombre = `${a.nombres} ${a.apellidos}`;
  const msg = debe > 0
    ? `Hola${a.apoderado_nombre ? ` ${a.apoderado_nombre.split(" ")[0]}` : ""}, le saluda Fotos Jefferson. Le recordamos que el pedido de ${a.nombres} tiene un saldo de ${S(debe)}. Puede pagar por Yape o Plin. ¡Gracias!`
    : `Hola${a.apoderado_nombre ? ` ${a.apoderado_nombre.split(" ")[0]}` : ""}, le saluda Fotos Jefferson, sobre las fotos de ${a.nombres}.`;

  return (
    <>
      <PageHeader
        modulo="colegios"
        title={`${a.apellidos}, ${a.nombres}`}
        crumbs={[
          { href: "/panel/colegios", label: "Colegios" },
          ...(k?.colegios ? [{ href: `/panel/colegios/${k.colegios.id}`, label: k.colegios.nombre }] : []),
          ...(k ? [{ href: `/panel/campanas/${k.id}`, label: k.nombre }] : []),
        ]}
        subtitle={<>{salon(a)} · {k ? `${TIPO_CAMPANA[k.tipo]} ${k.anio}` : ""} · Sede {NOMBRE_SEDE[k?.colegios?.sede ?? "nauta"]} · <span className="code">{a.codigo}</span></>}
        actions={
          <>
            <WhatsApp sm={false} href={whatsapp(a.apoderado_telefono, msg)} />
            {veDinero && debe > 0 && <Link className="btn secondary" href={`/panel/cobros?q=${a.codigo}`}><HandCoins className="i" /> Cobrar</Link>}
            {puede(perfil, "pedidos") && <Link className="btn" href={`/panel/pedidos/nuevo?alumno=${a.id}`}><ShoppingBag className="i" /> Nuevo pedido</Link>}
          </>
        }
      />
      <Aviso {...aviso} />

      {veDinero && (
        <div className="kpis ficha-kpis">
          <div className="kpi"><div className="top">Compró</div><div className="val">{S(total)}</div><div className="sub">{vigentes.length} {vigentes.length === 1 ? "pedido" : "pedidos"}</div></div>
          <div className="kpi"><div className="top">Pagó</div><div className="val">{S(pagado)}</div><div className="sub">{(pagosData ?? []).filter((p) => p.estado === "confirmado").length} pagos</div></div>
          <div className={`kpi${debe > 0 ? " alert" : ""}`}><div className="top">Debe</div><div className={`val${debe > 0 ? " neg" : ""}`}>{S(debe)}</div><div className="sub">{debe > 0 ? "saldo pendiente" : vigentes.length ? "todo pagado" : "sin pedidos"}</div></div>
        </div>
      )}

      <div className="grid-2 ficha">
        <div className="ficha-col">
          <section className="card">
            <div className="card-head"><h2>Pedidos</h2></div>
            {pedidos.length === 0 ? (
              <Empty icon={ShoppingBag} title="Aún no tiene pedidos">{puede(perfil, "pedidos") && <Link href={`/panel/pedidos/nuevo?alumno=${a.id}`}>Crear el primero</Link>}</Empty>
            ) : (
              <ul className="list">
                {pedidos.map((p) => {
                  const [txt, cls] = ESTADO_PEDIDO[p.estado] ?? [p.estado, "b-neutral"];
                  const s = saldo.get(p.id);
                  return (
                    <li key={p.id} className="item ficha-pedido">
                      <div className="main">
                        <span className="tl-ico"><Receipt /></span>
                        <div>
                          <div className="title">Pedido N.º {p.numero} <span className={`badge ${cls}`}>{txt}</span></div>
                          <div className="meta">
                            {p.pedido_items.map((i) => `${i.cantidad > 1 ? `${i.cantidad} × ` : ""}${i.productos?.nombre ?? ""}`).join(" + ") || "Sin productos"}
                          </div>
                          <div className="meta">Hecho el {fecha(p.creado_en)}{p.entregado_en && ` · entregado el ${fecha(p.entregado_en)}`}{p.notas && ` · ${p.notas}`}</div>
                        </div>
                      </div>
                      {veDinero && (
                        <div className="end ficha-montos">
                          <b>{S(p.total)}</b>
                          {p.estado !== "anulado" && (s && s.saldo > 0 ? <span className="badge b-warn">Debe {S(s.saldo)}</span> : <span className="badge b-good">Pagado</span>)}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {veDinero && (pagosData ?? []).length > 0 && (
            <section className="card">
              <div className="card-head"><h2>Pagos</h2></div>
              <ol className="timeline">
                {(pagosData ?? []).map((p) => (
                  <li key={p.id}>
                    <span className="tl-ico"><CircleCheck /></span>
                    <div>
                      <p><b>{S(p.monto)}</b> en {METODO[p.metodo] ?? p.metodo} · pedido N.º {numero.get(p.pedido_id)}{" "}
                        {p.estado !== "confirmado" && <span className={`badge ${p.estado === "rechazado" ? "b-bad" : "b-warn"}`}>{p.estado === "rechazado" ? "Rechazado" : "Por confirmar"}</span>}
                      </p>
                      <small>{fecha(p.creado_en)}{p.operacion && ` · operación ${p.operacion}`}</small>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="card">
            <div className="card-head"><h2>Fotos</h2><Link className="btn ghost sm" href={`/panel/fotos?campana=${a.campana_id}`}>Ir a Fotos</Link></div>
            {fotos.length === 0 ? (
              <Empty icon={ImageOff} title="Sin fotos todavía">Sube un archivo con el nombre <span className="code">{a.codigo}.jpg</span> y se asocia solo.</Empty>
            ) : (
              <div className="ficha-fotos">
                {fotos.map((f) => {
                  const [t, c] = ESTADO_FOTO[f.estado] ?? [f.estado, "b-neutral"];
                  const url = f.ruta_vista ? firmadas.get(f.ruta_vista) : null;
                  return (
                    <figure key={f.id}>
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={nombre} loading="lazy" />
                      ) : (
                        <div className="foto-espera"><ImageOff className="i" /></div>
                      )}
                      <figcaption><span className={`badge ${c}`}>{t}</span> {f.producto.split(",").join(" + ")}</figcaption>
                    </figure>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="ficha-col">
          <section className="card">
            <div className="card-head">
              <h2>Datos</h2>
              <Modal label="Editar" title="Editar datos del alumno" icon={<Pencil className="i" />} variant="secondary">
                <form action={editarAlumno} className="form">
                  <input type="hidden" name="id" value={a.id} />
                  <div className="fields">
                    <label className="field">Apellidos<input className="input" name="apellidos" defaultValue={a.apellidos} required /></label>
                    <label className="field">Nombres<input className="input" name="nombres" defaultValue={a.nombres} required /></label>
                    <label className="field">Grado<input className="input" name="grado" defaultValue={a.grado ?? ""} /></label>
                    <label className="field">Sección<input className="input" name="seccion" defaultValue={a.seccion ?? ""} /></label>
                    <label className="field">DNI<input className="input" name="dni" defaultValue={a.dni ?? ""} inputMode="numeric" /></label>
                    <label className="field">Apoderado<input className="input" name="apoderado_nombre" defaultValue={a.apoderado_nombre ?? ""} /></label>
                    <label className="field">Celular del apoderado<input className="input" name="apoderado_telefono" defaultValue={a.apoderado_telefono ?? ""} inputMode="tel" /></label>
                  </div>
                  <div className="form-foot"><button className="btn" type="submit">Guardar</button></div>
                </form>
              </Modal>
            </div>
            <div className="card-body">
              <dl className="info-list">
                <div><dt>Colegio</dt><dd>{k?.colegios ? <Link href={`/panel/colegios/${k.colegios.id}`}>{k.colegios.nombre}</Link> : "—"}</dd></div>
                <div><dt>Campaña</dt><dd>{k ? <Link href={`/panel/campanas/${k.id}`}>{k.nombre}</Link> : "—"}</dd></div>
                <div><dt>Salón</dt><dd>{salon(a)}</dd></div>
                <div><dt>DNI</dt><dd>{a.dni ?? "—"}</dd></div>
                <div><dt>Apoderado</dt><dd>{a.apoderado_nombre ?? "—"}</dd></div>
                <div>
                  <dt>Celular</dt>
                  <dd className="ficha-tel">
                    {a.apoderado_telefono ? (
                      <>
                        {a.apoderado_telefono}
                        <a className="btn ghost sm" href={`tel:${tel}`}><Phone className="i" /> Llamar</a>
                      </>
                    ) : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          {(hermanos.data ?? []).length > 0 && (
            <section className="card">
              <div className="card-head"><h2><Users className="i" /> Mismo apoderado</h2></div>
              <ul className="list">
                {(hermanos.data ?? []).map((h) => (
                  <li key={h.id}>
                    <Link className="item" href={`/panel/alumnos/${h.id}`}>
                      <div className="main">
                        <Avatar name={`${h.nombres} ${h.apellidos}`} />
                        <div>
                          <div className="title">{h.apellidos}, {h.nombres}</div>
                          <div className="meta">{h.campanas?.colegios?.nombre} · {salon(h)}</div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
