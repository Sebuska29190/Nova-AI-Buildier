/**
 * TokenSelector — Professional token selection with balances, search, icons
 */
import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { TOKENS, type TokenInfo } from "../../config/tokens";

interface TokenSelectorProps {
  chainId: number;
  value: string; // token address
  onChange: (address: string) => void;
  excludeAddress?: string;
  label?: string;
}

export function TokenSelector({ chainId, value, onChange, excludeAddress, label }: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tokens = (TOKENS[chainId] || []).filter(t => t.address !== excludeAddress);
  const filtered = search
    ? tokens.filter(t => t.symbol.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase()))
    : tokens;

  const selected = tokens.find(t => t.address === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {label && <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-1 block">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="glass-input w-full px-3 py-2.5 text-sm flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 truncate">
          {selected ? (
            <>
              <span className="text-base">{selected.symbol === "ETH" ? "⟠" : selected.symbol === "USDC" ? "💵" : selected.symbol === "SOL" ? "◎" : "🪙"}</span>
              <span className="font-medium text-white">{selected.symbol}</span>
              <span className="text-[#475569] text-xs">{selected.name}</span>
            </>
          ) : (
            <span className="text-[#475569]">Select token...</span>
          )}
        </span>
        <ChevronDown size={14} className={`text-[#475569] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#12121a] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in-up">
          {/* Search */}
          <div className="p-2 border-b border-[rgba(255,255,255,0.06)]">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#475569]" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search token..."
                className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#475569] outline-none focus:border-[rgba(99,102,241,0.3)]"
              />
            </div>
          </div>

          {/* Token List */}
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-[#475569]">No tokens found</div>
            ) : (
              filtered.map(token => {
                const isSelected = token.address === value;
                return (
                  <button
                    key={token.address}
                    type="button"
                    onClick={() => { onChange(token.address); setOpen(false); setSearch(""); }}
                    className={`w-full px-3 py-2 text-left flex items-center gap-3 transition-colors ${
                      isSelected
                        ? "bg-[rgba(99,102,241,0.1)]"
                        : "hover:bg-[rgba(255,255,255,0.04)]"
                    }`}
                  >
                    <span className="text-lg w-8 text-center">
                      {token.symbol === "ETH" ? "⟠" : token.symbol === "USDC" ? "💵" : token.symbol === "SOL" ? "◎" : "🪙"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white">{token.symbol}</p>
                      <p className="text-[10px] text-[#475569] truncate">{token.name}</p>
                    </div>
                    {isSelected && <Check size={14} className="text-[#6366f1] flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
