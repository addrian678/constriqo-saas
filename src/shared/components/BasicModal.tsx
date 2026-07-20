import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

type BasicModalProps = {
  title: string;
  open: boolean;
  children: ReactNode;
  footer?: ReactNode;
  size?: "normal" | "wide";
  onClose: () => void;
};

export function BasicModal({ title, open, children, footer, size = "normal", onClose }: BasicModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className={`modal ${size === "wide" ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2 className="card-title">{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer === null ? null : (
          <div className="modal-footer">
            {footer}
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
