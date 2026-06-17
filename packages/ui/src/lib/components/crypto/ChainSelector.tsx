/**
 * ChainSelector — Visual chain switcher
 */
import { GlassBadge } from "../ui/GlassBadge";

interface ChainSelectorProps {
  selectedChainId: number;
  onChainChange: (chainId: number) => void;
  showAll?: boolean;
}

const CHAINS = [
  { id: 1, name: "Ethereum", icon: "⟠", color: "#627EEA" },
  { id: 8453, name: "Base", icon: "🔵", color: "#0052FF" },
  { id: 42161, name: "Arbitrum", icon: "🔷", color: "#28A0F0" },
  { id: 137, name: "Polygon", icon: "🟣", color: "#8247E5" },
  { id: 56, name: "BNB Chain", icon: "🟡", color: "#F0B90B" },
  { id: 0, name: "Solana", icon: "◎", color: "#9945FF" },
];

export function ChainSelector({ selectedChainId, onChainChange, showAll = false }: ChainSelectorProps) {
  const chains = showAll ? CHAINS : CHAINS.filter(c => c.id !== 0); // Solana separate

  return (
    <div className="flex gap-1.5 flex-wrap">
      {chains.map(chain => {
        const isActive = selectedChainId === chain.id;
        return (
          <button
            key={chain.id}
            onClick={() => onChainChange(chain.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              isActive
                ? "bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.3)] text-[#818cf8] shadow-[0_0_12px_rgba(99,102,241,0.1)]"
                : "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-[#94a3b8] hover:border-[rgba(255,255,255,0.12)] hover:text-white"
            }`}
          >
            <span>{chain.icon}</span>
            <span>{chain.name}</span>
          </button>
        );
      })}
    </div>
  );
}
