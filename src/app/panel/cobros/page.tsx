import Link from "next/link";
import { PERMISOS, requirePerfil } from "@/lib/auth";
import { Aviso } from "@/components/aviso";
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
  const { supabase } = await requirePerfil(PERMISOS.cobros);
  const busqueda = q.trim();

  // Resumen de todos los pedidos vigentes
  const { data: todos } = await supabase.from("pedidos_saldo").select("pagado, saldo").neq("estado", "anulado").returns<Pick<Saldo, "pagado" | "saldo">[]>();
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
    <section>
      <h1>Cobros</h1>
      <p className="lead">Quién pagó y quién debe. Busca al alumno, escribe cuánto pagó y toca cómo pagó.</p>
      <Aviso {...aviso} />

      <div className="grid stats">
        <div className="stat"><div className="lbl">Pagado completo</div><div className="num">{completos}</div></div>
        <div className="stat"><div className="lbl">Con adelanto</div><div className="num">{adelanto}</div></div>
        <div className={`stat ${sinPagar ? "alert" : ""}`}><div className="lbl">Sin pagar</div><div className="num">{sinPagar}</div></div>
      </div>

      {(porVerificar ?? []).length > 0 && (
        <div className="card" id="verificar">
          <h2>Pagos por verificar</h2>
          <p className="lead">Revisa que cada Yape o Plin haya llegado al celular del negocio antes de confirmarlo.</p>
          {(porVerificar ?? []).map((p) => {
            const pedido = p.pedidos as unknown as { numero: number; alumnos: { nombres: string; apellidos: string } };
            const quien = p.perfiles as unknown as { nombre: string } | null;
            return (
              <div className="row" key={p.id}>
                <div className="grow">
                  <b>{pedido.alumnos.apellidos}, {pedido.alumnos.nombres}</b>
                  <div className="sub">
                    Pedido N.º {pedido.numero} · {METODO[p.metodo]} op. {p.operacion ?? "—"} · {fecha(p.creado_en)}
                    {quien && ` · anotó ${quien.nombre}`}
                  </div>
                </div>
                <span className="money">{S(p.monto)}</span>
                <form action={verificarPago} className="payopts">
                  <input type="hidden" name="pago_id" value={p.id} />
                  <button className="btn small" name="estado" value="confirmado">Sí llegó</button>
                  <button className="btn small bad" name="estado" value="rechazado">No llegó</button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <form className="toolbar" action="/panel/cobros">
        <label className="f" style={{ flex: 1, minWidth: 220 }}>
          <input name="q" defaultValue={busqueda} placeholder="Buscar alumno por apellido, nombre o código" />
        </label>
        <button className="btn" type="submit">Buscar</button>
        {busqueda && <Link className="btn ghost" href="/panel/cobros">Ver todos los que deben</Link>}
      </form>

      <div className="card">
        <h2>{busqueda ? `Pedidos de “${busqueda}”` : "Pedidos con saldo"}</h2>
        {(pedidos ?? []).length === 0 && (
          <p className="empty">
            {busqueda
              ? "No encontré pedidos. Para crear uno, abre la campaña del alumno y toca “Nuevo pedido”."
              : "Nadie debe. Todo está cobrado."}
          </p>
        )}
        {(pedidos ?? []).map((p) => {
          const a = alumnos.get(p.alumno_id);
          const saldo = Number(p.saldo);
          const [estado, claseEstado] = ESTADO_PEDIDO[p.estado] ?? [p.estado, "p-info"];
          const deuda = saldo <= 0 ? ["p-good", "Pagado"] : Number(p.pagado) > 0 ? ["p-warn", `Debe ${S(saldo)}`] : ["p-bad", `Debe ${S(saldo)}`];
          return (
            <div className="row" key={p.id}>
              <div className="grow">
                <b>{a ? `${a.apellidos}, ${a.nombres}` : "Alumno"}</b>
                <div className="sub">
                  Pedido N.º {p.numero} · total <span className="money">{S(p.total)}</span>
                  {a && [a.grado, a.seccion].some(Boolean) && ` · ${[a.grado, a.seccion].filter(Boolean).join(" ")}`}
                </div>
              </div>
              <span className={`pill ${claseEstado}`}>{estado}</span>
              <span className={`pill ${deuda[0]}`}>{deuda[1]}</span>
              {saldo > 0 && (
                <form action={registrarPago} className="payopts">
                  <input type="hidden" name="pedido_id" value={p.id} />
                  <input type="hidden" name="q" value={busqueda} />
                  <input name="monto" inputMode="decimal" defaultValue={saldo.toFixed(2)} aria-label="Monto en soles" />
                  <input name="operacion" className="op" placeholder="N.º operación" aria-label="Número de operación (Yape o Plin)" />
                  <button name="metodo" value="efectivo">Efectivo</button>
                  <button name="metodo" value="yape">Yape</button>
                  <button name="metodo" value="plin">Plin</button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
