import Link from "next/link";
import { ChevronRight, HandCoins, Search, ShoppingBag } from "lucide-react";
import { puede, requirePerfil } from "@/lib/auth";
import { Avatar, Empty, PageHeader } from "@/components/ui";
import { SimpleLista, SimpleTitulo } from "@/components/simple";
import { BusquedaViva } from "@/components/busqueda-viva";

type AlumnoEncontrado = {
  id: string;
  codigo: string;
  nombres: string;
  apellidos: string;
  grado: string | null;
  seccion: string | null;
  campana_id: string;
  campanas: { nombre: string; colegios: { nombre: string } | null } | null;
};

// Resultados de la búsqueda de la barra superior: colegios y alumnos de todas las campañas.
export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { supabase, perfil } = await requirePerfil();
  const texto = q.trim();
  const patron = `%${texto.replace(/[%_,()]/g, " ")}%`;

  const [colegios, alumnos] = texto
    ? await Promise.all([
        supabase.from("colegios").select("id, codigo, nombre, ciudad").or(`nombre.ilike.${patron},codigo.ilike.${patron}`).limit(10),
        supabase
          .from("alumnos")
          .select("id, codigo, nombres, apellidos, grado, seccion, campana_id, campanas(nombre, colegios(nombre))")
          .or(`apellidos.ilike.${patron},nombres.ilike.${patron},codigo.ilike.${patron}`)
          .order("apellidos")
          .limit(40)
          .returns<AlumnoEncontrado[]>(),
      ])
    : [null, null];

  const nCol = colegios?.data?.length ?? 0;
  const nAlu = alumnos?.data?.length ?? 0;

  // Vista sencilla: un buscador grande y una sola lista; tocar a alguien abre su ficha.
  if (perfil.preferencias.vista === "sencilla") {
    return (
      <div className="simple">
        <SimpleTitulo titulo="Buscar" sub={texto ? `${nCol + nAlu} ${nCol + nAlu === 1 ? "resultado" : "resultados"} para “${texto}”` : "Escribe el apellido del alumno o el colegio"} />
        <BusquedaViva autoFocus placeholder="Apellido, nombre o colegio" />
        {texto && (
          <SimpleLista
            vacio="No encontramos nada. Prueba solo con el apellido."
            filas={[
              ...(colegios?.data ?? []).map((c) => ({ key: c.id, href: `/panel/colegios/${c.id}`, titulo: c.nombre, avatar: c.nombre, sub: `Colegio · ${c.ciudad}` })),
              ...(alumnos?.data ?? []).map((a) => ({
                key: a.id, href: `/panel/alumnos/${a.id}`, titulo: `${a.apellidos}, ${a.nombres}`, avatar: `${a.nombres} ${a.apellidos}`,
                sub: [a.campanas?.colegios?.nombre, a.grado && `${a.grado} ${a.seccion ?? ""}`].filter(Boolean).join(" · "),
              })),
            ]}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        modulo="buscar"
        title={texto ? `Resultados para “${texto}”` : "Buscar un alumno o colegio"}
        subtitle={texto ? `${nCol + nAlu} ${nCol + nAlu === 1 ? "resultado" : "resultados"}` : "También puedes usar la barra de arriba en cualquier pantalla."}
      />
      <BusquedaViva autoFocus placeholder="Escribe un apellido, nombre, código o colegio" />
      {texto && nCol + nAlu === 0 && (
        <div className="card">
          <Empty icon={Search} title="No encontramos nada">Revisa la ortografía o prueba solo con el apellido.</Empty>
        </div>
      )}
      {nCol > 0 && (
        <div className="card">
          <div className="card-head"><h2>Colegios</h2></div>
          <div className="list">
            {colegios!.data!.map((c) => (
              <Link className="item" key={c.id} href={`/panel/colegios/${c.id}`}>
                <div className="main">
                  <Avatar name={c.nombre} square />
                  <div>
                    <div className="title">{c.nombre}</div>
                    <div className="meta">{c.ciudad} · <span className="code">{c.codigo}</span></div>
                  </div>
                </div>
                <div className="end"><ChevronRight className="i chev" /></div>
              </Link>
            ))}
          </div>
        </div>
      )}
      {nAlu > 0 && (
        <div className="card">
          <div className="card-head"><h2>Alumnos</h2></div>
          <div className="list">
            {alumnos!.data!.map((a) => (
              <div className="item" key={a.id}>
                <Link className="main" href={`/panel/alumnos/${a.id}`}>
                  <Avatar name={`${a.nombres} ${a.apellidos}`} />
                  <div>
                    <div className="title">{a.apellidos}, {a.nombres}</div>
                    <div className="meta">
                      {[a.campanas?.colegios?.nombre, a.campanas?.nombre, a.grado && `${a.grado} ${a.seccion ?? ""}`].filter(Boolean).join(" · ")}
                      {" · "}<span className="code">{a.codigo}</span>
                    </div>
                  </div>
                </Link>
                <div className="end">
                  {puede(perfil, "cobros") && (
                    <Link className="btn secondary sm" href={`/panel/cobros?q=${encodeURIComponent(a.codigo)}`}>
                      <HandCoins className="i" /> Cobrar
                    </Link>
                  )}
                  {puede(perfil, "pedidos") && (
                    <Link className="btn sm" href={`/panel/pedidos/nuevo?alumno=${a.id}`}>
                      <ShoppingBag className="i" /> Pedido
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
