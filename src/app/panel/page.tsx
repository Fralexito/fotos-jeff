import Link from "next/link";
import { requirePerfil, puede } from "@/lib/auth";
import { S, TIPO_CAMPANA, fecha, inicioDeHoyLima, saludo } from "@/lib/formato";
import { IconoCobro, IconoColegio } from "@/components/iconos";

export default async function Inicio() {
  const { supabase, perfil } = await requirePerfil();
  const veDinero = puede(perfil, "cobros");

  const [hoy, saldos, listos, porVerificar, proximas] = await Promise.all([
    veDinero
      ? supabase.from("pagos").select("monto").eq("estado", "confirmado").gte("creado_en", inicioDeHoyLima())
      : null,
    veDinero ? supabase.from("pedidos_saldo").select("saldo").neq("estado", "anulado").gt("saldo", 0) : null,
    supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("estado", "en_impresion"),
    veDinero
      ? supabase.from("pagos").select("id", { count: "exact", head: true }).eq("estado", "por_verificar")
      : null,
    supabase
      .from("campanas")
      .select("id, nombre, tipo, fecha_captura, colegios(nombre)")
      .neq("estado", "cerrada")
      .order("fecha_captura", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  const cobradoHoy = (hoy?.data ?? []).reduce((s, p) => s + Number(p.monto), 0);
  const porCobrar = (saldos?.data ?? []).reduce((s, p) => s + Number(p.saldo), 0);
  const familiasConSaldo = saldos?.data?.length ?? 0;
  const nVerificar = porVerificar?.count ?? 0;

  return (
    <section>
      <h1>
        {saludo()}, {perfil.nombre.split(" ")[0]}
      </h1>
      <p className="lead">Esto es lo que pasa hoy en el estudio. Toque un botón grande para empezar.</p>

      <div className="grid stats">
        {veDinero && (
          <>
            <div className="stat">
              <div className="lbl">Cobrado hoy</div>
              <div className="num">{S(cobradoHoy)}</div>
            </div>
            <Link className="stat" href="/panel/cobros">
              <div className="lbl">Por cobrar</div>
              <div className="num">{S(porCobrar)}</div>
              <div className="sub">{familiasConSaldo} pedidos con saldo</div>
            </Link>
          </>
        )}
        <div className="stat">
          <div className="lbl">Listos para entregar</div>
          <div className="num">{listos.count ?? 0}</div>
        </div>
        {nVerificar > 0 && (
          <Link className="stat alert" href="/panel/cobros#verificar">
            <div className="lbl">Pagos por verificar</div>
            <div className="num">{nVerificar}</div>
          </Link>
        )}
      </div>

      <div className="grid big">
        {veDinero && (
          <Link className="bigbtn primary" href="/panel/cobros">
            <IconoCobro />
            <b>Registrar un pago</b>
            <span>Efectivo, Yape o Plin</span>
          </Link>
        )}
        <Link className="bigbtn" href="/panel/colegios">
          <IconoColegio />
          <b>Colegios y alumnos</b>
          <span>Listas, secciones y fechas</span>
        </Link>
      </div>

      <div className="card">
        <h2>Próximas sesiones</h2>
        {(proximas.data ?? []).length === 0 && <p className="empty">No hay campañas abiertas todavía.</p>}
        {(proximas.data ?? []).map((c) => {
          const colegio = c.colegios as unknown as { nombre: string } | null;
          return (
            <div className="row" key={c.id}>
              <Link className="grow" href={`/panel/campanas/${c.id}`}>
                <b>
                  {colegio?.nombre} · {c.nombre}
                </b>
                <div className="sub">{TIPO_CAMPANA[c.tipo]}</div>
              </Link>
              <span className={`pill ${c.fecha_captura ? "p-info" : "p-warn"}`}>
                {c.fecha_captura ? fecha(c.fecha_captura + "T12:00:00-05:00") : "Sin fecha"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
