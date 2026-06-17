/**
 * ChainDropdown — Chain selection dropdown with icons
 */
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface ChainDropdownProps {
  value: number;
  onChange: (chainId: number) => void;
  excludeChainId?: number;
  label?: string;
}

const CHAINS = [
  { id: 1, name: "Ethereum", icon: "⟠", symbol: "ETH", color: "#627EEA" },
  { id: 8453, name: "Base", icon: "🔵", symbol: "ETH", color: "#0052FF" },
  { id: 42161, name: "Arbitrum", icon: "🔷", symbol: "ETH", color: "#28A0F0" },
  { id: 137, name: "Polygon", icon: "🟣", symbol: "POL", color: "#8247E5" },
  { id: 56, name: "BNB Chain", icon: "🟡", symbol: "BNB", color: "#F0B90B" },
];

export function ChainDropdown({ value, onChange, excludeChainId, label }: ChainDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const chains = CHAINS.filter(c => c.id !== excludeChainId);
  const selected = chains.find(c => c.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {label && <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-1 block">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="glass-input w-full px-3 py-2.5 text-sm flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2">
          <span>{selected?.icon || "⛓️"}</span>
          <span className="text-white font-medium">{selected?.name || "Select chain"}</span>
        </span>
        <ChevronDown size={14} className={`text-[#475569] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#12121a] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in-up">
          <div className="py-1">
            {chains.map(chain => {
              const isSelected = chain.id === value;
              return (
                <button
                  key={chain.id}
                  type="button"
                  onClick={() => { onChange(chain.id); setOpen(false); }}
                  className={`w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors ${
                    isSelected ? "bg-[rgba(99,102,241,0.1)]" : "hover:bg-[rgba(255,255,255,0.04)]"
                  }`}
                >
                  <span className="text-lg">{chain.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-white">{chain.name}</p>
                    <p className="text-[10px] text-[#475569]">{chain.symbol}</p>
                  </div>
                  {isSelected && <Check size={14} className="text-[#6366f1]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
