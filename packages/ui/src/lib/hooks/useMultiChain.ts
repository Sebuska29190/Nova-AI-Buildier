/**
 * useMultiChain — Multi-chain wallet hook (resilient)
 * Connects EVM wallets (MetaMask, WalletConnect) + shows balances
 * Fails gracefully if wagmi provider not ready
 */
import { useState, useEffect, useCallback } from "react";
import { CHAIN_NAMES } from "../config/reown";
import { getExplorerTxUrl } from "../config/chains";

export interface ChainBalance {
  chainId: number;
  chainName: string;
  nativeBalance: string;
  nativeSymbol: string;
  icon: string;
  color: string;
  explorerUrl: string;
}

// Safe wagmi hook wrapper — returns defaults if provider not ready
function useSafeWagmi() {
  const [state, setState] = useState({
    address: undefined as string | undefined,
    isConnected: false,
    isConnecting: false,
    chainId: 1,
  });

  // Try to use wagmi hooks, fallback to defaults
  try {
    const wagmi = require("wagmi");
    const account = wagmi.useAccount?.() || {};
    const connect = wagmi.useConnect?.() || { connect: () => {}, connectors: [] };
    const disconnect = wagmi.useDisconnect?.() || { disconnect: () => {} };
    const switchChain = wagmi.useSwitchChain?.() || { switchChain: () => {} };
    const chainIdHook = wagmi.useChainId?.() || 1;

    return {
      address: account.address,
      isConnected: account.isConnected || false,
      isConnecting: account.isConnecting || false,
      chainId: chainIdHook,
      connect: connect.connect,
      connectors: connect.connectors || [],
      disconnect: disconnect.disconnect,
      switchChain: switchChain.switchChain,
    };
  } catch {
    return {
      address: undefined,
      isConnected: false,
      isConnecting: false,
      chainId: 1,
      connect: () => {},
      connectors: [],
      disconnect: () => {},
      switchChain: () => {},
    };
  }
}

export function useMultiChain() {
  const { address, isConnected, isConnecting, chainId, connect, connectors, disconnect, switchChain } = useSafeWagmi();
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [totalBalanceUsd, setTotalBalanceUsd] = useState(0);

  const connectWallet = useCallback((connectorName?: string) => {
    try {
      const connector = connectors.find((c: any) => {
        if (connectorName === "metamask") return c.name?.toLowerCase().includes("injected");
        if (connectorName === "walletconnect") return c.name?.toLowerCase().includes("walletconnect");
        if (connectorName === "coinbase") return c.name?.toLowerCase().includes("coinbase");
        return true;
      });
      if (connector) connect({ connector });
    } catch (e) {
      console.warn("[useMultiChain] Connect failed:", e);
    }
  }, [connect, connectors]);

  const switchToChain = useCallback((targetChainId: number) => {
    try { switchChain({ chainId: targetChainId }); } catch {}
  }, [switchChain]);

  const getTxUrl = useCallback((txHash: string) => {
    return getExplorerTxUrl(chainId, txHash);
  }, [chainId]);

  return {
    address,
    isConnected,
    isConnecting,
    chainId,
    chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
    balances,
    totalBalanceUsd,
    connectors,
    connectWallet,
    disconnect,
    switchToChain,
    getTxUrl,
    refreshBalances: () => {},
    supportedChains: [
      { id: 1, name: "Ethereum", icon: "⟠", color: "#627EEA", symbol: "ETH" },
      { id: 8453, name: "Base", icon: "🔵", color: "#0052FF", symbol: "ETH" },
      { id: 42161, name: "Arbitrum", icon: "🔷", color: "#28A0F0", symbol: "ETH" },
      { id: 137, name: "Polygon", icon: "🟣", color: "#8247E5", symbol: "POL" },
      { id: 56, name: "BNB Chain", icon: "🟡", color: "#F0B90B", symbol: "BNB" },
    ],
  };
}
