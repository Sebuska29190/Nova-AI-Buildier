import { useState, useEffect, createContext, useContext, useCallback } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  visible: boolean;
}

interface ToastContextValue {
  showToast: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((msg: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message: msg, type, visible: false }]);
    // Trigger animation
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, visible: true } : t));
    }, 10);
    // Auto remove
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, visible: false } : t));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-200 flex flex-col gap-2">
        {toasts.map((toast) => {
          const typeStyles: Record<string, string> = {
            success: "bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30",
            error: "bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30",
            info: "bg-[#2dd4bf]/15 text-[#2dd4bf] border-[#2dd4bf]/30",
          };
          const icons: Record<string, string> = {
            success: "✅",
            error: "❌",
            info: "ℹ️",
          };

          return (
            <div
              key={toast.id}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-md border max-w-[400px] transition-transform duration-300 ease-out ${
                toast.visible ? "translate-x-0" : "translate-x-[120%]"
              } ${typeStyles[toast.type] || typeStyles.info}`}
            >
              <span className="text-sm shrink-0">{icons[toast.type]}</span>
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => {
                  setToasts((prev) => prev.map((t) => t.id === toast.id ? { ...t, visible: false } : t));
                  setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 300);
                }}
                className="bg-none border-none text-inherit opacity-60 cursor-pointer text-xs p-0.5 shrink-0 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
