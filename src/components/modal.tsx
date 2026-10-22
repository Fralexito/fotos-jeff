"use client";

import { useRef } from "react";
import { X } from "lucide-react";

// Botón que abre un diálogo con un formulario. Se cierra solo al enviar.
export function Modal({
  label,
  title,
  icon,
  variant = "",
  children,
}: {
  label: string;
  title: string;
  icon?: React.ReactNode;
  variant?: "" | "secondary";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
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
