// Cada pantalla entra con un leve desliz hacia arriba, como en las apps del celular.
export default function Plantilla({ children }: { children: React.ReactNode }) {
  return <div className="pagina">{children}</div>;
}
