import Link from "next/link";
import { CalendarDays, Camera, ChevronRight, HandCoins, Images, PackageCheck, Truck } from "lucide-react";
import { puede, requirePerfil } from "@/lib/auth";
import { S, dia, hoyLima, inicioDeHoyLima, whatsapp } from "@/lib/formato";
import { deudores } from "@/lib/reportes";
import { SEDES } from "@/lib/sedes";
import { Contador } from "@/components/contador";
import { Refrescar } from "@/components/refrescar";
import { WhatsApp } from "@/components/ui";
import { Barras } from "@/components/graficos";

type Evento = { id: string; nombre: string; fecha_captura: string | null; fecha_entrega: string | null; colegios: { nombre: string } | null };

// Vista del abuelo: todo el negocio (las tres sedes) en una sola pantalla grande, sin menús ni botones de más.
export default async function Hoy() {
  const { supabase, perfil } = await requirePerfil();
  const veDinero = puede(perfil, "cobros");
  const hoy = hoyLima();
  const en7 = new Date(new Date(hoy + "T12:00:00Z").getTime() + 7 * 86400000).toISOString().slice(0, 10);

  const dias = Array.from({ length: 7 }, (_, i) => new Date(new Date(hoy + "T12:00:00Z").getTime() - (6 - i) * 86400000).toISOString().slice(0, 10));
  const [pagosHoy, deben, listos, porAprobar, eventos, semana] = await Promise.all([
    veDinero
      ? supabase.from("pagos").select("monto, pedidos!inner(sede)").eq("estado", "confirmado").gte("creado_en", inicioDeHoyLima())
          .returns<{ monto: number; pedidos: { sede: string } }[]>()
      : null,
    veDinero ? deudores(supabase) : [],
    supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("estado", "en_impresion"),
    supabase.from("fotos").select("id", { count: "exact", head: true }).in("estado", ["procesada", "excepcion"]),
    supabase
      .from("campanas")
      .select("id, nombre, fecha_captura, fecha_entrega, colegios(nombre)")
      .neq("estado", "cerrada")
      .or(`and(fecha_captura.gte.${hoy},fecha_captura.lte.${en7}),and(fecha_entrega.gte.${hoy},fecha_entrega.lte.${en7})`)
      .returns<Evento[]>(),
    veDinero
      ? supabase.from("pagos").select("monto, creado_en").eq("estado", "confirmado").gte("creado_en", `${dias[0]}T00:00:00-05:00`).returns<{ monto: number; creado_en: string }[]>()
      : null,
  ]);
  const diaLima = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(iso));
  const porDia = dias.map((d) => (semana?.data ?? []).filter((p) => diaLima(p.creado_en) === d).reduce((s, p) => s + Number(p.monto), 0));
  const nombreDia = (d: string) => (d === hoy ? "Hoy" : new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z")).replace(".", ""));

  const porSede = SEDES.map(([id, nombre]) => [nombre, (pagosHoy?.data ?? []).filter((p) => p.pedidos.sede === id).reduce((s, p) => s + Number(p.monto), 0)] as const);
  const entroHoy = porSede.reduce((s, [, v]) => s + v, 0);
  const faltaCobrar = deben.reduce((s, d) => s + d.saldo, 0);
  const agenda = (eventos.data ?? [])
    .flatMap((c) => [
      ...(c.fecha_captura && c.fecha_captura >= hoy && c.fecha_captura <= en7 ? [{ fecha: c.fecha_captura, tipo: "toma", c }] : []),
      ...(c.fecha_entrega && c.fecha_entrega >= hoy && c.fecha_entrega <= en7 ? [{ fecha: c.fecha_entrega, tipo: "entrega", c }] : []),
    ])
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const fechaLarga = new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Lima" }).format(new Date());
  const cuando = (f: string) => (f === hoy ? "Hoy" : f === new Date(new Date(hoy + "T12:00:00Z").getTime() + 86400000).toISOString().slice(0, 10) ? "Mañana" : dia(f));

  return (
    <div className="abuelo">
      <Refrescar cada={60000} />
      <header className="abuelo-cab">
        <p>{fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)}</p>
        <h1>Así va el negocio hoy</h1>
      </header>

      {veDinero && (
        <section className="abuelo-caja">
          <span className="abuelo-et">Hoy entró</span>
          <span className="abuelo-monto"><Contador valor={entroHoy} soles /></span>
          <div className="abuelo-sedes">
            {porSede.map(([nombre, v]) => (
              <span key={nombre}><small>{nombre}</small><b>{S(v)}</b></span>
            ))}
          </div>
        </section>
      )}

      {veDinero && (
        <section className="card abuelo-semana">
          <div className="card-head"><h2>Lo que entró esta semana</h2><b className="abuelo-semana-total">{S(porDia.reduce((a, b) => a + b, 0))}</b></div>
          <div className="card-body">
            <Barras series={["Entró"]} alto={150} resaltar={6} grupos={dias.map((d, i) => ({ etiqueta: nombreDia(d), valores: [porDia[i]] }))} />
          </div>
        </section>
      )}

      <div className="abuelo-tres">
        {veDinero && (
          <Link href="/panel/cobros/whatsapp" className="abuelo-dato" data-modulo="cobros">
            <HandCoins />
            <span className="abuelo-et">Falta cobrar</span>
            <b>{S(faltaCobrar)}</b>
            <small>{deben.length} {deben.length === 1 ? "pedido" : "pedidos"}</small>
          </Link>
        )}
        <Link href="/panel/produccion?vista=entregas" className="abuelo-dato" data-modulo="produccion">
          <PackageCheck />
          <span className="abuelo-et">Para entregar</span>
          <b>{listos.count ?? 0}</b>
          <small>pedidos ya impresos</small>
        </Link>
        <Link href="/panel/fotos" className="abuelo-dato" data-modulo="fotos">
          <Images />
          <span className="abuelo-et">Fotos por aprobar</span>
          <b>{porAprobar.count ?? 0}</b>
          <small>ya editadas por el motor</small>
        </Link>
      </div>

      <div className="abuelo-listas">
        {veDinero && (
          <section className="card">
            <div className="card-head"><h2>Los que más deben</h2><Link className="btn ghost sm" href="/panel/cobros/whatsapp">Cobrar a todos <ChevronRight className="i" /></Link></div>
            {deben.length === 0 ? (
              <p className="abuelo-vacio">Nadie debe. ¡Todo cobrado!</p>
            ) : (
              <ol className="abuelo-lista">
                {deben.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <Link href={`/panel/alumnos/${d.alumnoId}`}><b>{d.alumno}</b><small>{d.colegio}{d.salon && ` · ${d.salon}`}</small></Link>
                    <span className="abuelo-debe">{S(d.saldo)}</span>
                    <WhatsApp label="" href={whatsapp(d.telefono, `Hola, le saluda Fotos Jefferson. Le recordamos que el pedido N.º ${d.numero} de ${d.alumno.split(", ")[1] ?? d.alumno} tiene un saldo de ${S(d.saldo)}. Puede pagar por Yape o Plin. ¡Gracias!`)} />
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
        <section className="card">
          <div className="card-head"><h2>Esta semana</h2><Link className="btn ghost sm" href="/panel/calendario">Calendario <ChevronRight className="i" /></Link></div>
          {agenda.length === 0 ? (
            <p className="abuelo-vacio"><CalendarDays className="i" /> No hay tomas ni entregas en los próximos 7 días.</p>
          ) : (
            <ol className="abuelo-lista">
              {agenda.map((e) => (
                <li key={`${e.c.id}-${e.tipo}`}>
                  <span className={`abuelo-ev ${e.tipo}`}>{e.tipo === "toma" ? <Camera /> : <Truck />}</span>
                  <span><b>{e.c.colegios?.nombre}</b><small>{e.tipo === "toma" ? "Toma de fotos" : "Entrega"} · {e.c.nombre}</small></span>
                  <span className="abuelo-cuando">{cuando(e.fecha)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <p className="abuelo-pie">Esta pantalla se actualiza sola cada minuto. Muestra las tres sedes juntas.</p>
    </div>
  );
}
