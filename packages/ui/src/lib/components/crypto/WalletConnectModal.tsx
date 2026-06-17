/**
 * WalletConnectModal — Unified wallet connection modal
 * Supports: MetaMask, WalletConnect, Coinbase, Phantom, Solflare
 */
import { X, ExternalLink, Loader2 } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: (wallet: string) => void;
  connecting?: boolean;
}

const WALLETS = [
  { id: "metamask", name: "MetaMask", icon: "🦊", description: "Ethereum, Base, Arbitrum, Polygon, BSC", chains: "EVM" },
  { id: "walletconnect", name: "WalletConnect", icon: "🔗", description: "350+ wallets via QR code", chains: "EVM" },
  { id: "coinbase", name: "Coinbase Wallet", icon: "🔵", description: "Coinbase ecosystem", chains: "EVM" },
  { id: "phantom", name: "Phantom", icon: "👻", description: "Solana ecosystem", chains: "Solana" },
  { id: "solflare", name: "Solflare", icon: "☀️", description: "Solana wallet", chains: "Solana" },
];

export function WalletConnectModal({ open, onClose, onConnect, connecting }: WalletConnectModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 animate-fade-in-up">
        <GlassCard padding="lg" className="!rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Connect Wallet</h2>
              <p className="text-xs text-[#475569] mt-0.5">Choose a wallet to connect</p>
            </div>
            <button onClick={onClose} className="text-[#475569] hover:text-white transition-colors p-1">
              <X size={20} />
            </button>
          </div>

          {/* Wallet List */}
          <div className="space-y-2">
            {WALLETS.map(wallet => (
              <button
                key={wallet.id}
                onClick={() => onConnect(wallet.id)}
                disabled={connecting}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-[rgba(255,255,255,0.06)] hover:border-[rgba(99,102,241,0.2)] hover:bg-[rgba(255,255,255,0.03)] transition-all group disabled:opacity-50"
              >
                <span className="text-2xl">{wallet.icon}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white group-hover:text-[#818cf8] transition-colors">{wallet.name}</p>
                  <p className="text-[10px] text-[#475569]">{wallet.description}</p>
                </div>
                <span className="text-[9px] text-[#475569] font-mono px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)]">{wallet.chains}</span>
                {connecting && <Loader2 size={14} className="animate-spin text-[#6366f1]" />}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.06)] text-center">
            <p className="text-[10px] text-[#475569]">
              New to crypto?{" "}
              <a href="https://metamask.io" target="_blank" rel="noreferrer" className="text-[#6366f1] hover:underline inline-flex items-center gap-0.5">
                Get MetaMask <ExternalLink size={8} />
              </a>
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
