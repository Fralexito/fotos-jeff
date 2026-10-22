import { CircleAlert, CircleCheck } from "lucide-react";

// Mensaje verde o rojo que dejan las acciones en la URL (?ok=... o ?error=...).
export function Aviso({ ok, error }: { ok?: string; error?: string }) {
  if (error)
    return (
      <div className="notice err" role="alert">
        <CircleAlert className="i" />
        {error}
      </div>
    );
  if (ok)
    return (
      <div className="notice ok" role="status">
        <CircleCheck className="i" />
        {ok}
      </div>
    );
  return null;
}
