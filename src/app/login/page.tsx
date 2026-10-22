import { Camera, CircleCheck } from "lucide-react";
import { Aviso } from "@/components/aviso";
import { entrar } from "./actions";

const ERRORES: Record<string, string> = {
  credenciales: "Correo o contraseña incorrectos.",
  "sin-perfil": "Tu usuario aún no tiene un rol asignado. Pide al dueño que te dé acceso.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="auth">
      <section className="brand-side">
        <div className="logo" style={{ padding: 0 }}>
          <span className="mark"><Camera /></span>
          <span><b>Fotos Jefferson</b><small>Estudio fotográfico · Nauta</small></span>
        </div>
        <div>
          <h2>Todo el estudio en un solo lugar.</h2>
          <p>Colegios, alumnos, pedidos y cobros ordenados, desde cualquier computadora o celular.</p>
          <div className="feats">
            <div className="feat"><CircleCheck className="i" /> Listas de alumnos con código para cada foto</div>
            <div className="feat"><CircleCheck className="i" /> Cobros en efectivo, Yape y Plin sin cuaderno</div>
            <div className="feat"><CircleCheck className="i" /> Lo cobrado y lo pendiente, al día</div>
          </div>
        </div>
        <div className="foot">Fotografía escolar en Nauta e Iquitos</div>
      </section>
      <section className="form-side">
        <div className="form-box">
          <h1>Iniciar sesión</h1>
          <p>Entra con el correo y la contraseña que te dio el estudio.</p>
          <Aviso error={error ? (ERRORES[error] ?? "No se pudo entrar.") : undefined} />
          <form action={entrar} className="form">
            <label className="field">
              Correo electrónico
              <input type="email" name="email" autoComplete="email" required placeholder="nombre@correo.com" />
            </label>
            <label className="field">
              Contraseña
              <input type="password" name="password" autoComplete="current-password" required />
            </label>
            <button className="btn lg block" type="submit">Entrar</button>
          </form>
        </div>
      </section>
    </div>
  );
}
