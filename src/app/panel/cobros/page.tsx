import Link from "next/link";
import { CircleCheck, CircleDashed, CircleDot, Receipt, Search, Send } from "lucide-react";
import { filtroSede } from "@/lib/sedes";
import { PERMISOS, requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
import { Avatar, Empty, PageHeader } from "@/components/ui";
import { ESTADO_PEDIDO, S, fecha } from "@/lib/formato";
import { registrarPago, verificarPago } from "../actions";

type Saldo = { id: string; numero: number; alumno_id: string; estado: string; total: number; pagado: number; saldo: number };
type Alumno = { id: string; nombres: string; apellidos: string; grado: string | null; seccion: string | null };

const METODO: Record<string, string> = { efectivo: "Efectivo", yape: "Yape", plin: "Plin", transferencia: "Transferencia", tarjeta: "Tarjeta" };

export default async function Cobros({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const { q = "", ...aviso } = await searchParams;
  const { supabase, perfil } = await requirePerfil(PERMISOS.cobros);
  const busqueda = q.trim();
  const sede = filtroSede(perfil.preferencias.sede);

  // Resumen de todos los pedidos vigentes
  let qTodos = supabase.from("pedidos_saldo").select("pagado, saldo").neq("estado", "anulado");
  if (sede) qTodos = qTodos.eq("sede", sede);
  const { data: todos } = await qTodos.returns<Pick<Saldo, "pagado" | "saldo">[]>();
  const completos = (todos ?? []).filter((p) => Number(p.saldo) <= 0).length;
  const adelanto = (todos ?? []).filter((p) => Number(p.saldo) > 0 && Number(p.pagado) > 0).length;
  const sinPagar = (todos ?? []).filter((p) => Number(p.saldo) > 0 && Number(p.pagado) <= 0).length;

  // Lista: con búsqueda, los pedidos de esos alumnos; sin búsqueda, los que deben.
  let alumnosBuscados: Alumno[] | null = null;
  if (busqueda) {
    const patron = `%${busqueda.replace(/[%_,()]/g, " ")}%`;
    const { data } = await supabase
      .from("alumnos")
      .select("id, nombres, apellidos, grado, seccion")
      .or(`apellidos.ilike.${patron},nombres.ilike.${patron},codigo.ilike.${patron}`)
      .limit(40)
      .returns<Alumno[]>();
    alumnosBuscados = data ?? [];
  }
  let consulta = supabase.from("pedidos_saldo").select("id, numero, alumno_id, estado, total, pagado, saldo").neq("estado", "anulado");
  if (sede) consulta = consulta.eq("sede", sede);
  consulta = alumnosBuscados ? consulta.in("alumno_id", alumnosBuscados.map((a) => a.id)) : consulta.gt("saldo", 0);
  const { data: pedidos } = await consulta.order("numero", { ascending: false }).limit(50).returns<Saldo[]>();

  const { data: porVerificar } = await supabase
    .from("pagos")
    .select("id, monto, metodo, operacion, creado_en, pedidos(numero, alumnos(nombres, apellidos)), perfiles(nombre)")
    .eq("estado", "por_verificar")
    .order("creado_en");

  // Nombres de los alumnos de la lista
  const ids = [...new Set((pedidos ?? []).map((p) => p.alumno_id))];
  const alumnos = new Map<string, Alumno>((alumnosBuscados ?? []).map((a) => [a.id, a]));
  const faltan = ids.filter((id) => !alumnos.has(id));
  if (faltan.length) {
    const { data } = await supabase.from("alumnos").select("id, nombres, apellidos, grado, seccion").in("id", faltan).returns<Alumno[]>();
    (data ?? []).forEach((a) => alumnos.set(a.id, a));
  }

  return (
    <>
      <PageHeader modulo="cobros"
        title="Cobros" subtitle="Quién pagó y quién debe. Busca al alumno, escribe el monto y elige cómo pagó."
        actions={<Link className="btn wa" href="/panel/cobros/whatsapp"><Send className="i" /> Cobrar por WhatsApp</Link>} />
      <Aviso {...aviso} />

      <div className="kpis detalle">
        <div className="kpi">
          <div className="top">Pagado completo <span className="ico"><CircleCheck className="i" /></span></div>
          <div className="val">{completos}</div>
          <div className="sub">pedidos sin saldo</div>
        </div>
        <div className="kpi">
          <div className="top">Con adelanto <span className="ico warn"><CircleDot className="i" /></span></div>
          <div className="val">{adelanto}</div>
          <div className="sub">pagaron una parte</div>
        </div>
        <div className={`kpi ${sinPagar ? "alert" : ""}`}>
          <div className="top">Sin pagar <span className="ico bad"><CircleDashed className="i" /></span></div>
          <div className="val">{sinPagar}</div>
          <div className="sub">aún no pagan nada</div>
        </div>
      </div>

      {(porVerificar ?? []).length > 0 && (
        <div className="card warn" id="verificar">
          <div className="card-head">
            <div>
              <h2>Pagos por verificar</h2>
              <p>Revisa que cada Yape o Plin haya llegado al celular del negocio antes de confirmarlo.</p>
            </div>
          </div>
          <div className="list">
            {(porVerificar ?? []).map((p) => {
              const pedido = p.pedidos as unknown as { numero: number; alumnos: { nombres: string; apellidos: string } };
              const quien = p.perfiles as unknown as { nombre: string } | null;
              return (
                <div className="item" key={p.id}>
                  <div className="main">
                    <Avatar name={`${pedido.alumnos.nombres} ${pedido.alumnos.apellidos}`} />
                    <div>
                      <div className="title">{pedido.alumnos.apellidos}, {pedido.alumnos.nombres}</div>
                      <div className="meta">
                        Pedido N.º {pedido.numero} · {METODO[p.metodo]} · op. {p.operacion ?? "—"} · {fecha(p.creado_en)}
                        {quien && ` · anotó ${quien.nombre}`}
                      </div>
                    </div>
                  </div>
                  <div className="end">
                    <span className="money">{S(p.monto)}</span>
                    <form action={verificarPago} className="payform">
                      <input type="hidden" name="pago_id" value={p.id} />
                      <button className="btn sm" name="estado" value="confirmado">Sí llegó</button>
                      <button className="btn danger sm" name="estado" value="rechazado">No llegó</button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <form action="/panel/cobros" style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
            <div className="search">
              <Search className="i" />
              <input className="input" name="q" defaultValue={busqueda} placeholder="Buscar alumno por apellido, nombre o código" />
            </div>
            <button className="btn secondary" type="submit">Buscar</button>
            {busqueda && <Link className="btn ghost" href="/panel/cobros">Limpiar</Link>}
          </form>
        </div>
        <div className="card-head" style={{ background: "var(--surface-2)", paddingTop: 10, paddingBottom: 10 }}>
          <h2 style={{ fontSize: 14 }}>{busqueda ? `Pedidos de “${busqueda}”` : "Pedidos con saldo pendiente"}</h2>
          <span className="meta" style={{ color: "var(--muted)", fontSize: 13 }}>{(pedidos ?? []).length} pedidos</span>
        </div>
        {(pedidos ?? []).length === 0 ? (
          <Empty icon={Receipt} title={busqueda ? "Sin pedidos" : "Todo cobrado"}>
            {busqueda
              ? "Para crear un pedido, abre la campaña del alumno y toca “Nuevo pedido”."
              : "No hay pedidos con saldo pendiente."}
          </Empty>
        ) : (
          <div className="list">
            {(pedidos ?? []).map((p) => {
              const a = alumnos.get(p.alumno_id);
              const nombre = a ? `${a.apellidos}, ${a.nombres}` : "Alumno";
              const saldo = Number(p.saldo);
              const [estado, claseEstado] = ESTADO_PEDIDO[p.estado] ?? [p.estado, "b-neutral"];
              const deuda = saldo <= 0 ? ["b-good", "Pagado"] : Number(p.pagado) > 0 ? ["b-warn", `Debe ${S(saldo)}`] : ["b-bad", `Debe ${S(saldo)}`];
              return (
                <div className="item" key={p.id}>
                  <div className="main">
                    <Avatar name={a ? `${a.nombres} ${a.apellidos}` : "?"} />
                    <div>
                      <Link className="title" href={`/panel/alumnos/${p.alumno_id}`}>{nombre}</Link>
                      <div className="meta">
                        N.º {p.numero} · total {S(p.total)} · pagado {S(p.pagado)}
                        {a && (a.grado || a.seccion) && ` · ${[a.grado && `${a.grado}.º`, a.seccion].filter(Boolean).join(" ")}`}
                      </div>
                    </div>
                  </div>
                  <div className="end">
                    <span className={`badge ${claseEstado}`}>{estado}</span>
                    <span className={`badge ${deuda[0]}`}>{deuda[1]}</span>
                    {saldo > 0 && (
                      <form action={registrarPago} className="payform">
                        <input type="hidden" name="pedido_id" value={p.id} />
                        <input type="hidden" name="q" value={busqueda} />
                        <input className="input" name="monto" inputMode="decimal" defaultValue={saldo.toFixed(2)} aria-label="Monto en soles" />
                        <input className="input op" name="operacion" placeholder="N.º operación" aria-label="Número de operación (Yape o Plin)" />
                        <div className="seg">
                          <button name="metodo" value="efectivo">Efectivo</button>
                          <button name="metodo" value="yape">Yape</button>
                          <button name="metodo" value="plin">Plin</button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
