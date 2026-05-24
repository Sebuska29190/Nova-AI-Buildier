interface ToggleProps {
  active: boolean;
  onClick: () => void;
  label?: string;
}

export function Toggle({ active, onClick, label }: ToggleProps) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
        active
          ? "bg-nova-accent text-nova-bg border-nova-accent"
          : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-600"
      }`}
    >
      {label}
    </button>
  );
}
