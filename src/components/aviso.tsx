// Mensaje verde o rojo que dejan las acciones en la URL (?ok=... o ?error=...).
export function Aviso({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <div className="notice err" role="alert">{error}</div>;
  if (ok) return <div className="notice ok" role="status">{ok}</div>;
  return null;
}
