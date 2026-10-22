// Esqueleto que aparece al instante mientras carga cada pantalla.
export default function Cargando() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Cargando">
      <div className="sk sk-title" />
      <div className="sk-row">
        <div className="sk sk-card" />
        <div className="sk sk-card" />
        <div className="sk sk-card" />
      </div>
      <div className="sk sk-block" />
    </div>
  );
}
