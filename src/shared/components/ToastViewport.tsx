import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";

type ToastItem = {
  id: string;
  tone: "success" | "warning" | "danger" | "info";
  message: string;
};

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handleToast(event: Event) {
      const detail = (event as CustomEvent<Partial<ToastItem>>).detail || {};
      const item: ToastItem = {
        id: crypto.randomUUID(),
        tone: detail.tone || "info",
        message: detail.message || "Operacion completada.",
      };
      setItems((current) => [item, ...current].slice(0, 4));
      window.setTimeout(() => {
        setItems((current) => current.filter((toast) => toast.id !== item.id));
      }, 3600);
    }

    window.addEventListener("constriqo:toast", handleToast);
    return () => {
      window.removeEventListener("constriqo:toast", handleToast);
    };
  }, []);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {items.map((item) => (
        <article className={`toast-item ${item.tone}`} key={item.id}>
          {item.tone === "danger" ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}
          <span>{item.message}</span>
          <button type="button" onClick={() => setItems((current) => current.filter((toast) => toast.id !== item.id))} aria-label="Cerrar notificacion">
            <X size={14} />
          </button>
        </article>
      ))}
    </div>
  );
}
