import { puede, requirePerfil } from "@/lib/auth";
import { PageHeader, Tabs } from "@/components/ui";
import { Hoja, type Columna, type FilaHoja } from "@/components/hoja";
import { ESTADO_PEDIDO, TIPO_CAMPANA } from "@/lib/formato";
import { alumnosConPedidos, salon, todas } from "@/lib/datos";
import { NOMBRE_SEDE, SEDES, filtroSede } from "@/lib/sedes";

const METODO: Record<string, string> = { efectivo: "Efectivo", yape: "Yape", plin: "Plin", transferencia: "Transferencia", tarjeta: "Tarjeta" };
const ESTADO_PAGO: Record<string, [string, string]> = {
  por_verificar: ["Por verificar", "b-warn"], confirmado: ["Confirmado", "b-good"], rechazado: ["Rechazado", "b-bad"],
};
const badges = (m: Record<string, [string, string]>) => Object.fromEntries(Object.values(m));
const PEDIDO = { ...badges(ESTADO_PEDIDO), "Sin pedido": "b-neutral" };
const diaLima = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(iso)) : null);

type NombreHoja = "alumnos" | "pedidos" | "pagos" | "caja";

export default async function Tabla({ searchParams }: { searchParams: Promise<{ hoja?: string }> }) {
  const { hoja: pedida } = await searchParams;
  const { supabase, perfil } = await requirePerfil();
  const sede = filtroSede(perfil.preferencias.sede);
  const SEDE_COL: Columna = { key: "sede", label: "Sede", badges: Object.fromEntries(SEDES.map(([, t]) => [t, "b-info"])) };
  const dinero = puede(perfil, "cobros");
  const hojas: [NombreHoja, string][] = [["alumnos", "Alumnos"], ["pedidos", "Pedidos"], ...(dinero ? ([["pagos", "Pagos"], ["caja", "Caja"]] as [NombreHoja, string][]) : [])];
  const hoja: NombreHoja = hojas.some(([k]) => k === pedida) ? (pedida as NombreHoja) : "alumnos";

  let columnas: Columna[] = [];
  let filas: FilaHoja[] = [];
  let fecha: string | undefined;

  if (hoja === "alumnos") {
    const alumnos = await alumnosConPedidos(supabase, sede);
    columnas = [
      SEDE_COL,
      { key: "colegio", label: "Colegio", ancho: 200 },
      { key: "campana", label: "Campaña", ancho: 200 },
      { key: "tipo", label: "Tipo", badges: { Promoción: "b-info", Graduación: "b-info", Carnets: "b-info", Otro: "b-neutral" } },
      { key: "anio", label: "Año" },
      { key: "salon", label: "Salón" },
      { key: "codigo", label: "Código", tipo: "codigo" },
      { key: "apellidos", label: "Apellidos", ancho: 160 },
      { key: "nombres", label: "Nombres", ancho: 140 },
      { key: "dni", label: "DNI" },
      { key: "apoderado", label: "Apoderado", ancho: 150 },
      { key: "telefono", label: "Celular" },
      { key: "pedidos", label: "Pedidos", tipo: "num" },
      { key: "estado", label: "Estado", badges: PEDIDO },
      { key: "total", label: "Total", tipo: "soles" },
      { key: "pagado", label: "Pagado", tipo: "soles" },
      { key: "saldo", label: "Debe", tipo: "soles" },
      { key: "creado", label: "Registrado", tipo: "fecha" },
    ];
    fecha = "creado";
    filas = alumnos
      .sort((a, b) => a.colegio.localeCompare(b.colegio, "es") || b.anio - a.anio || salon(a).localeCompare(salon(b), "es", { numeric: true }) || a.apellidos.localeCompare(b.apellidos, "es"))
      .map((a) => ({
        sede: NOMBRE_SEDE[a.sede] ?? a.sede, colegio: a.colegio, campana: a.campana, tipo: TIPO_CAMPANA[a.tipo] ?? a.tipo, anio: String(a.anio), salon: salon(a),
        codigo: a.codigo, apellidos: a.apellidos, nombres: a.nombres, dni: a.dni, apoderado: a.apoderado, telefono: a.telefono,
        pedidos: a.pedidos, estado: a.estado ? ESTADO_PEDIDO[a.estado]?.[0] ?? a.estado : "Sin pedido",
        total: a.total, pagado: a.pagado, saldo: a.saldo, creado: diaLima(a.creado),
        _href: `/panel/campanas/${a.campanaId}`,
      }));
  }

  if (hoja === "pedidos") {
    type P = {
      id: string; numero: number; estado: string; total: number; sede: string; creado_en: string; entregado_en: string | null; campana_id: string;
      alumnos: { codigo: string; nombres: string; apellidos: string; grado: string | null; seccion: string | null; apoderado_telefono: string | null } | null;
      campanas: { nombre: string; anio: number; colegios: { nombre: string } | null } | null;
      pedido_items: { cantidad: number; productos: { nombre: string } | null }[];
    };
    const [pedidos, saldos] = await Promise.all([
      todas<P>((a, b) => {
        let q = supabase
          .from("pedidos")
          .select("id, numero, estado, total, sede, creado_en, entregado_en, campana_id, alumnos(codigo, nombres, apellidos, grado, seccion, apoderado_telefono), campanas(nombre, anio, colegios(nombre)), pedido_items(cantidad, productos(nombre))")
          .order("numero", { ascending: false });
        if (sede) q = q.eq("sede", sede);
        return q.range(a, b).returns<P[]>();
      }),
      todas<{ id: string; pagado: number; saldo: number }>((a, b) => supabase.from("pedidos_saldo").select("id, pagado, saldo").order("id").range(a, b)),
    ]);
    const saldo = new Map(saldos.map((s) => [s.id, s]));
    columnas = [
      { key: "numero", label: "N.º" },
      { key: "fecha", label: "Fecha", tipo: "fecha" },
      SEDE_COL,
      { key: "colegio", label: "Colegio", ancho: 200 },
      { key: "campana", label: "Campaña", ancho: 180 },
      { key: "salon", label: "Salón" },
      { key: "codigo", label: "Código", tipo: "codigo" },
      { key: "alumno", label: "Alumno", ancho: 200 },
      { key: "telefono", label: "Celular" },
      { key: "productos", label: "Productos", ancho: 200 },
      { key: "estado", label: "Estado", badges: badges(ESTADO_PEDIDO) },
      { key: "total", label: "Total", tipo: "soles" },
      { key: "pagado", label: "Pagado", tipo: "soles" },
      { key: "saldo", label: "Debe", tipo: "soles" },
      { key: "entregado", label: "Entregado", tipo: "fecha" },
    ];
    fecha = "fecha";
    filas = pedidos.map((p) => {
      const s = saldo.get(p.id);
      const anulado = p.estado === "anulado";
      return {
        numero: String(p.numero), fecha: diaLima(p.creado_en),
        sede: NOMBRE_SEDE[p.sede] ?? p.sede, colegio: p.campanas?.colegios?.nombre ?? "", campana: p.campanas?.nombre ?? "",
        salon: p.alumnos ? salon(p.alumnos) : "", codigo: p.alumnos?.codigo ?? "",
        alumno: p.alumnos ? `${p.alumnos.apellidos}, ${p.alumnos.nombres}` : "", telefono: p.alumnos?.apoderado_telefono ?? null,
        productos: p.pedido_items.map((i) => `${i.cantidad > 1 ? i.cantidad + " × " : ""}${i.productos?.nombre ?? ""}`).join(", "),
        estado: ESTADO_PEDIDO[p.estado]?.[0] ?? p.estado,
        total: anulado ? 0 : Number(p.total), pagado: Number(s?.pagado ?? 0), saldo: anulado ? 0 : Number(s?.saldo ?? 0),
        entregado: diaLima(p.entregado_en),
        _href: `/panel/campanas/${p.campana_id}`,
      };
    });
  }

  if (hoja === "pagos") {
    type G = {
      monto: number; metodo: string; estado: string; operacion: string | null; creado_en: string;
      pedidos: { numero: number; sede: string; alumnos: { nombres: string; apellidos: string } | null; campanas: { colegios: { nombre: string } | null } | null } | null;
      perfiles: { nombre: string } | null;
    };
    const pagos = await todas<G>((a, b) => {
      let q = supabase
        .from("pagos")
        .select("monto, metodo, estado, operacion, creado_en, pedidos!inner(numero, sede, alumnos(nombres, apellidos), campanas(colegios(nombre))), perfiles(nombre)")
        .order("creado_en", { ascending: false });
      if (sede) q = q.eq("pedidos.sede", sede);
      return q.range(a, b).returns<G[]>();
    });
    columnas = [
      { key: "fecha", label: "Fecha", tipo: "fecha" },
      { key: "hora", label: "Hora" },
      SEDE_COL,
      { key: "pedido", label: "Pedido" },
      { key: "alumno", label: "Alumno", ancho: 200 },
      { key: "colegio", label: "Colegio", ancho: 200 },
      { key: "metodo", label: "Método", badges: Object.fromEntries(Object.values(METODO).map((m) => [m, "b-neutral"])) },
      { key: "operacion", label: "N.º operación" },
      { key: "estado", label: "Estado", badges: badges(ESTADO_PAGO) },
      { key: "monto", label: "Monto", tipo: "soles" },
      { key: "registro", label: "Registró" },
    ];
    fecha = "fecha";
    filas = pagos.map((g) => ({
      fecha: diaLima(g.creado_en),
      hora: new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" }).format(new Date(g.creado_en)),
      sede: g.pedidos ? NOMBRE_SEDE[g.pedidos.sede] ?? g.pedidos.sede : "",
      pedido: g.pedidos ? String(g.pedidos.numero) : "",
      alumno: g.pedidos?.alumnos ? `${g.pedidos.alumnos.apellidos}, ${g.pedidos.alumnos.nombres}` : "",
      colegio: g.pedidos?.campanas?.colegios?.nombre ?? "",
      metodo: METODO[g.metodo] ?? g.metodo, operacion: g.operacion,
      estado: ESTADO_PAGO[g.estado]?.[0] ?? g.estado, monto: Number(g.monto), registro: g.perfiles?.nombre ?? null,
    }));
  }

  if (hoja === "caja") {
    type M = { fecha: string; sede: string; tipo: string; categoria: string; concepto: string; monto: number; metodo: string; perfiles: { nombre: string } | null };
    const movs = await todas<M>((a, b) => {
      let q = supabase
        .from("movimientos_caja")
        .select("fecha, sede, tipo, categoria, concepto, monto, metodo, perfiles(nombre)")
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false });
      if (sede) q = q.eq("sede", sede);
      return q.range(a, b).returns<M[]>();
    });
    columnas = [
      { key: "fecha", label: "Fecha", tipo: "fecha" },
      SEDE_COL,
      { key: "tipo", label: "Tipo", badges: { Ingreso: "b-good", Gasto: "b-bad" } },
      { key: "categoria", label: "Categoría", badges: {} },
      { key: "concepto", label: "Concepto", ancho: 240 },
      { key: "metodo", label: "Método" },
      { key: "ingreso", label: "Ingreso", tipo: "soles" },
      { key: "egreso", label: "Gasto", tipo: "soles" },
      { key: "registro", label: "Registró" },
    ];
    fecha = "fecha";
    filas = movs.map((m) => ({
      fecha: m.fecha, sede: NOMBRE_SEDE[m.sede] ?? m.sede, tipo: m.tipo === "ingreso" ? "Ingreso" : "Gasto", categoria: m.categoria, concepto: m.concepto,
      metodo: METODO[m.metodo] ?? m.metodo,
      ingreso: m.tipo === "ingreso" ? Number(m.monto) : null, egreso: m.tipo === "egreso" ? Number(m.monto) : null,
      registro: m.perfiles?.nombre ?? null,
    }));
  }

  return (
    <>
      <PageHeader
        modulo="tabla"
        title="Tabla general"
        subtitle={`${sede ? `Sede ${NOMBRE_SEDE[sede]}. ` : ""}Todo ordenado como en Excel. Toca un título para ordenar y escribe debajo para filtrar.`}
      />
      <Tabs items={hojas.map(([k, t]) => ({ href: `/panel/tabla?hoja=${k}`, label: t, active: k === hoja }))} />
      <Hoja key={hoja} columnas={columnas} filas={filas} archivo={`${hoja}-fotos-jefferson`} fecha={fecha} />
    </>
  );
}
