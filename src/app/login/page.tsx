import { entrar } from "./actions";

const ERRORES: Record<string, string> = {
  credenciales: "Correo o contraseña incorrectos.",
  "sin-perfil": "Tu usuario aún no tiene un rol asignado. Pide al dueño que te dé acceso.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="login">
      <div className="card">
        <h1>Fotos Jeff</h1>
        <p className="lead">Entra con el correo y la contraseña que te dio el estudio.</p>
        {error && <div className="notice err">{ERRORES[error] ?? "No se pudo entrar."}</div>}
        <form action={entrar} className="stack">
          <label className="f">
            Correo
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label className="f">
            Contraseña
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <button className="btn" type="submit">Entrar</button>
        </form>
      </div>
    </div>
  );
}
