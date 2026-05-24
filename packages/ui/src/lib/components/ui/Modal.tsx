import { useEffect, useCallback } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Modal({ open, onClose, title = "", size = "md", children }: ModalProps) {
  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeydown);
      return () => document.removeEventListener("keydown", handleKeydown);
    }
  }, [open, handleKeydown]);

  if (!open) return null;

  const sizes: Record<string, string> = {
    sm: "w-[360px]",
    md: "w-[520px]",
    lg: "w-[720px]",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-300 animate-fade-in"
    >
      <div
        className={`panel-strong rounded-2xl shadow-[0_24px_48px_rgba(0,0,0,0.5)] max-h-[80vh] flex flex-col overflow-hidden animate-dialog-in ${sizes[size] || sizes.md}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-nova-border">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-nova-muted hover:text-nova-foreground cursor-pointer text-lg p-1 rounded-md hover:bg-nova-surface-3 leading-none transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
