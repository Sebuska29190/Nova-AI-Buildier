/**
 * SwapInterface — Professional multi-chain token swap
 * Real 1inch quotes, token selection with search, balance display
 */
import { useState, useEffect } from "react";
import { ArrowUpDown, ExternalLink, Settings, AlertTriangle } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { GlassButton } from "../ui/GlassButton";
import { GlassBadge } from "../ui/GlassBadge";
import { TokenSelector } from "./TokenSelector";
import { ChainDropdown } from "./ChainDropdown";
import { TOKENS } from "../../config/tokens";
import { CHAIN_NAMES } from "../../config/reown";
import { getExplorerTxUrl } from "../../config/chains";

interface SwapInterfaceProps {
  walletAddress?: string;
  walletChainId?: number;
  onConnect: () => void;
}

export function SwapInterface({ walletAddress, walletChainId = 1, onConnect }: SwapInterfaceProps) {
  const [chainId, setChainId] = useState(walletChainId);
  const [fromToken, setFromToken] = useState("");
  const [toToken, setToToken] = useState("");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; txHash?: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const chainTokens = TOKENS[chainId] || [];
  const fromTokenInfo = chainTokens.find(t => t.address === fromToken);
  const toTokenInfo = chainTokens.find(t => t.address === toToken);

  // Reset tokens when chain changes
  useEffect(() => {
    setFromToken("");
    setToToken("");
    setQuote(null);
    setResult(null);
  }, [chainId]);

  // Auto-select first two tokens
  useEffect(() => {
    if (chainTokens.length >= 2 && !fromToken) {
      setFromToken(chainTokens[0].address);
      setToToken(chainTokens[1].address);
    }
  }, [chainTokens, fromToken]);

  async function getQuote() {
    if (!fromToken || !toToken || !amount || !walletAddress) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/oneinch/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId,
          src: fromToken,
          dst: toToken,
          amount: String(Math.floor(parseFloat(amount) * Math.pow(10, fromTokenInfo?.decimals || 18))),
          from: walletAddress,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Quote failed");
      }
      const data = await res.json();
      setQuote(data);
    } catch (e: any) {
      setResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function executeSwap() {
    if (!quote || !walletAddress || !window.ethereum) return;
    setSwapping(true);
    setResult(null);
    try {
      const res = await fetch("/api/oneinch/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId,
          src: fromToken,
          dst: toToken,
          amount: String(Math.floor(parseFloat(amount) * Math.pow(10, fromTokenInfo?.decimals || 18))),
          from: walletAddress,
          slippage: parseFloat(slippage),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Swap failed");
      }
      const data = await res.json();

      // Send transaction to wallet for signing
      if (data.tx) {
        // Don't send gas — MetaMask estimates it automatically
        // Sending wrong gas causes "exceeds maximum per-tx gas limit" errors
        const txParams: any = {
          from: data.tx.from,
          to: data.tx.to,
          data: data.tx.data,
          value: data.tx.value || "0x0",
        };

        // Only include gas if it's a reasonable value (< 10M)
        if (data.tx.gas && data.tx.gas < 10000000) {
          txParams.gas = `0x${data.tx.gas.toString(16)}`;
        }

        const txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [txParams],
        });
        setResult({
          success: true,
          message: "Swap executed successfully!",
          txHash,
        });
      } else {
        throw new Error("No transaction data returned from 1inch");
      }
    } catch (e: any) {
      setResult({ success: false, message: e.message || "Swap failed" });
    } finally {
      setSwapping(false);
    }
  }

  // Calculate output amount from quote
  const outputAmount = quote?.dstAmount
    ? (parseFloat(quote.dstAmount) / Math.pow(10, toTokenInfo?.decimals || 18)).toFixed(6)
    : "0";

  // Gas estimate from 1inch (in gas units)
  const gasEstimate = quote?.gas || 0;
  const priceImpact = quote?.priceImpact || "0";

  // Calculate gas cost in native token
  const isL2 = [8453, 42161, 137].includes(chainId);
  const gasPriceGwei = isL2 ? 0.001 : 25; // L2 gas is ~1000x cheaper
  const gasCostEth = gasEstimate > 0 ? (gasEstimate * gasPriceGwei / 1e9) : 0;
  const nativeSymbol = CHAIN_NAMES[chainId]?.includes("Polygon") ? "POL" : CHAIN_NAMES[chainId]?.includes("BNB") ? "BNB" : "ETH";

  return (
    <GlassCard padding="lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ArrowUpDown size={16} className="text-[#6366f1]" /> Swap
        </h3>
        <div className="flex items-center gap-2">
          <GlassBadge variant="accent">{CHAIN_NAMES[chainId] || `Chain ${chainId}`}</GlassBadge>
          <button onClick={() => setShowSettings(!showSettings)} className="text-[#475569] hover:text-[#94a3b8] transition-colors">
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Chain Selector */}
      <div className="mb-3">
        <ChainDropdown value={chainId} onChange={setChainId} label="Network" />
      </div>

      {/* Slippage Settings */}
      {showSettings && (
        <div className="mb-3 p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] animate-fade-in-up">
          <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-2 block">Slippage Tolerance</label>
          <div className="flex gap-2">
            {["0.5", "1", "3"].map(s => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                  slippage === s
                    ? "bg-[rgba(99,102,241,0.15)] text-[#818cf8] border border-[rgba(99,102,241,0.3)]"
                    : "bg-[rgba(255,255,255,0.04)] text-[#475569] border border-[rgba(255,255,255,0.06)] hover:text-[#94a3b8]"
                }`}
              >
                {s}%
              </button>
            ))}
            <input
              type="number"
              value={slippage}
              onChange={e => setSlippage(e.target.value)}
              className="glass-input w-20 px-2 py-1.5 text-xs text-center"
              step="0.1"
              min="0.1"
              max="50"
            />
          </div>
        </div>
      )}

      {/* From Token */}
      <div className="mb-2">
        <TokenSelector chainId={chainId} value={fromToken} onChange={setFromToken} excludeAddress={toToken} label="You Pay" />
      </div>
      <div className="mb-3">
        <input
          type="number"
          value={amount}
          onChange={e => { setAmount(e.target.value); setQuote(null); }}
          className="glass-input w-full px-4 py-3 text-lg text-right font-mono"
          placeholder="0.0"
          step="any"
          min="0"
        />
        {fromTokenInfo && (
          <p className="text-[10px] text-[#475569] mt-1 text-right">{fromTokenInfo.name} • {fromTokenInfo.symbol}</p>
        )}
      </div>

      {/* Swap Arrow */}
      <div className="flex justify-center my-2">
        <button
          onClick={() => {
            const t = fromToken;
            setFromToken(toToken);
            setToToken(t);
            setQuote(null);
            setResult(null);
          }}
          className="w-8 h-8 rounded-full bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.2)] flex items-center justify-center text-[#818cf8] hover:bg-[rgba(99,102,241,0.2)] transition-all hover:rotate-180 duration-300"
        >
          <ArrowUpDown size={14} />
        </button>
      </div>

      {/* To Token */}
      <div className="mb-3">
        <TokenSelector chainId={chainId} value={toToken} onChange={setToToken} excludeAddress={fromToken} label="You Receive" />
      </div>

      {/* Quote Result */}
      {quote && (
        <div className="mb-3 p-3 rounded-xl bg-[rgba(99,102,241,0.05)] border border-[rgba(99,102,241,0.15)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#94a3b8]">Minimum received</span>
            <span className="text-sm font-bold text-white">{outputAmount} {toTokenInfo?.symbol || ""}</span>
          </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-[#475569] mt-2">
            <div>
              <span className="block">Price Impact</span>
              <span className={`font-medium ${parseFloat(priceImpact) > 1 ? "text-[#ef4444]" : "text-[#22c55e]"}`}>{parseFloat(priceImpact).toFixed(4)}%</span>
            </div>
            <div>
              <span className="block">Slippage</span>
              <span className="font-medium text-[#94a3b8]">{slippage}%</span>
            </div>
            <div>
              <span className="block">Gas Fee</span>
              <span className={`font-medium ${isL2 ? "text-[#22c55e]" : "text-[#f59e0b]"}`}>
                {gasEstimate > 0 ? `${gasCostEth.toFixed(6)} ${nativeSymbol}` : "—"}
              </span>
            </div>
          </div>
          <div className="mt-2 p-2 rounded-lg bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.15)]">
            <p className="text-[10px] text-[#f59e0b] flex items-center gap-1">
              <AlertTriangle size={10} />
              You need {nativeSymbol} in your wallet to pay for network gas fees.
            </p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`mb-3 p-3 rounded-xl text-xs ${
          result.success
            ? "bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] text-[#22c55e]"
            : "bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-[#ef4444]"
        }`}>
          <p className="font-medium">{result.message}</p>
          {result.txHash && (
            <a href={getExplorerTxUrl(chainId, result.txHash)} target="_blank" rel="noreferrer"
              className="text-[#6366f1] hover:underline mt-1 inline-flex items-center gap-1">
              View on Explorer
            </a>
          )}
        </div>
      )}

      {/* Actions */}
      {walletAddress ? (
        <div className="flex gap-2">
          {!quote ? (
            <GlassButton
              variant="primary"
              className="flex-1"
              onClick={getQuote}
              loading={loading}
              disabled={!fromToken || !toToken || !amount || parseFloat(amount) <= 0}
            >
              Get Quote
            </GlassButton>
          ) : (
            <>
              <GlassButton variant="ghost" className="flex-1" onClick={() => { setQuote(null); setResult(null); }}>
                New Quote
              </GlassButton>
              <GlassButton variant="primary" className="flex-1" onClick={executeSwap} loading={swapping}>
                Swap
              </GlassButton>
            </>
          )}
        </div>
      ) : (
        <GlassButton variant="primary" className="w-full" onClick={onConnect}>
          Connect Wallet to Swap
        </GlassButton>
      )}
    </GlassCard>
  );
}
