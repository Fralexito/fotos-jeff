"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Botón que abre un diálogo con un formulario. Se cierra solo al enviar.
export function Modal({
  label,
  title,
  icon,
  variant = "",
  abrir = false,
  children,
}: {
  label: string;
  title: string;
  icon?: React.ReactNode;
  variant?: "" | "secondary";
  /** Se abre solo al cargar la página (p. ej. desde el botón Nuevo de la barra superior). */
  abrir?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (abrir && !ref.current?.open) ref.current?.showModal();
  }, [abrir]);
  return (
    <>
      <button type="button" className={`btn ${variant}`} onClick={() => ref.current?.showModal()}>
        {icon}
        {label}
      </button>
      <dialog ref={ref} className="modal" onSubmit={() => ref.current?.close()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={() => ref.current?.close()}>
            <X className="i" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </dialog>
    </>
  );
}
