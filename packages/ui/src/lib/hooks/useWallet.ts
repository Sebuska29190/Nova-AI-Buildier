/**
 * useWallet — Real wallet connection via browser providers
 * Supports: MetaMask (EVM), Phantom (Solana)
 * No wagmi dependency — uses raw window.ethereum / window.phantom
 */
import { useState, useEffect, useCallback } from "react";

export interface WalletInfo {
  address: string;
  chainId: number;
  chainName: string;
  walletName: string;
  balance: string;
  symbol: string;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect available wallets
  const detectWallets = useCallback(() => {
    const wallets: string[] = [];
    if (window.ethereum?.isMetaMask) wallets.push("MetaMask");
    if (window.ethereum?.isCoinbaseWallet) wallets.push("Coinbase");
    if (window.phantom?.solana?.isPhantom) wallets.push("Phantom");
    if (window.solana?.isPhantom) wallets.push("Phantom");
    if (window.solflare?.isSolflare) wallets.push("Solflare");
    // Generic EVM
    if (window.ethereum && !window.ethereum.isMetaMask && !window.ethereum.isCoinbaseWallet) wallets.push("Browser Wallet");
    return wallets;
  }, []);

  // Connect to MetaMask / EVM wallet
  const connectEVM = useCallback(async () => {
    if (!window.ethereum) throw new Error("No EVM wallet found. Install MetaMask.");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts?.length) throw new Error("No accounts returned");
    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    const chainId = parseInt(chainIdHex, 16);
    const balance = await window.ethereum.request({
      method: "eth_getBalance",
      params: [accounts[0], "latest"],
    });
    const balanceEth = (parseInt(balance, 16) / 1e18).toFixed(4);
    const chainNames: Record<number, string> = { 1: "Ethereum", 8453: "Base", 42161: "Arbitrum", 137: "Polygon", 56: "BNB Chain" };
    return {
      address: accounts[0],
      chainId,
      chainName: chainNames[chainId] || `Chain ${chainId}`,
      walletName: window.ethereum.isMetaMask ? "MetaMask" : window.ethereum.isCoinbaseWallet ? "Coinbase" : "Browser Wallet",
      balance: balanceEth,
      symbol: "ETH",
    };
  }, []);

  // Connect to Phantom (Solana)
  const connectSolana = useCallback(async () => {
    const provider = window.phantom?.solana || window.solana;
    if (!provider?.isPhantom) throw new Error("No Solana wallet found. Install Phantom.");
    const response = await provider.connect();
    const publicKey = response.publicKey?.toString();
    if (!publicKey) throw new Error("No public key returned");

    // Fetch real SOL balance from RPC
    let balance = "0";
    try {
      const rpcUrl = "https://api.mainnet-beta.solana.com";
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [publicKey] }),
      });
      const data = await res.json();
      balance = (data.result?.value / 1e9 || 0).toFixed(4);
    } catch {}

    return {
      address: publicKey,
      chainId: 0,
      chainName: "Solana",
      walletName: "Phantom",
      balance,
      symbol: "SOL",
    };
  }, []);

  // Connect
  const connect = useCallback(async (walletName?: string) => {
    setConnecting(true);
    setError(null);
    try {
      const available = detectWallets();
      if (available.length === 0) throw new Error("No wallet found. Install MetaMask or Phantom.");

      // Decide which wallet to connect
      const isSolana = walletName === "Phantom" || walletName === "Solflare";
      const isEVM = !isSolana;

      let info: WalletInfo;
      if (isEVM) {
        info = await connectEVM();
      } else {
        info = await connectSolana();
      }

      setWallet(info);

      // Listen for account/chain changes (EVM)
      if (window.ethereum) {
        window.ethereum.on("accountsChanged", (accounts: string[]) => {
          if (accounts.length === 0) {
            setWallet(null);
          } else if (wallet) {
            setWallet(prev => prev ? { ...prev, address: accounts[0] } : null);
          }
        });
        window.ethereum.on("chainChanged", () => {
          // Reload on chain change
          window.location.reload();
        });
      }

      // Listen for disconnect (Solana)
      const solProvider = window.phantom?.solana || window.solana;
      if (solProvider) {
        solProvider.on("disconnect", () => setWallet(null));
      }

      return info;
    } catch (e: any) {
      const msg = e.message || "Failed to connect";
      setError(msg);
      return null;
    } finally {
      setConnecting(false);
    }
  }, [detectWallets, connectEVM, connectSolana, wallet]);

  // Disconnect — ACTUALLY disconnects
  const disconnect = useCallback(async () => {
    try {
      // EVM disconnect
      if (window.ethereum) {
        // Remove listeners
        window.ethereum.removeAllListeners?.("accountsChanged");
        window.ethereum.removeAllListeners?.("chainChanged");
        // Some wallets support wallet_revokePermissions
        try {
          await window.ethereum.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
        } catch {}
      }

      // Solana disconnect
      const solProvider = window.phantom?.solana || window.solana;
      if (solProvider) {
        try {
          await solProvider.disconnect();
        } catch {}
        solProvider.removeAllListeners?.("disconnect");
        solProvider.removeAllListeners?.("accountChanged");
      }

      // Clear state
      setWallet(null);
      setError(null);
    } catch (e) {
      // Even if disconnect fails, clear local state
      setWallet(null);
    }
  }, []);

  // Switch chain (EVM only)
  const switchChain = useCallback(async (chainId: number) => {
    if (!window.ethereum || !wallet) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
      // Reload to update state
      window.location.reload();
    } catch (e: any) {
      // Chain not added, try to add it
      if (e.code === 4902) {
        const chainConfigs: Record<number, any> = {
          8453: { chainId: "0x2105", chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"], blockExplorerUrls: ["https://basescan.org"] },
          42161: { chainId: "0xa4b1", chainName: "Arbitrum One", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://arb1.arbitrum.io/rpc"], blockExplorerUrls: ["https://arbiscan.io"] },
          137: { chainId: "0x89", chainName: "Polygon Mainnet", nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 }, rpcUrls: ["https://polygon-rpc.com"], blockExplorerUrls: ["https://polygonscan.com"] },
          56: { chainId: "0x38", chainName: "BNB Smart Chain", nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, rpcUrls: ["https://bsc-dataseed.binance.org"], blockExplorerUrls: ["https://bscscan.com"] },
        };
        const config = chainConfigs[chainId];
        if (config) {
          try { await window.ethereum.request({ method: "wallet_addEthereumChain", params: [config] }); } catch {}
        }
      }
    }
  }, [wallet]);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!wallet) return;
    try {
      if (wallet.chainId !== 0 && window.ethereum) {
        // EVM balance
        const balance = await window.ethereum.request({
          method: "eth_getBalance",
          params: [wallet.address, "latest"],
        });
        const balanceEth = (parseInt(balance, 16) / 1e18).toFixed(4);
        setWallet(prev => prev ? { ...prev, balance: balanceEth } : null);
      }
    } catch {}
  }, [wallet]);

  // Auto-detect if already connected
  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (window.ethereum) {
          const accounts = await window.ethereum.request({ method: "eth_accounts" });
          if (accounts?.length > 0) {
            const info = await connectEVM();
            setWallet(info);
          }
        }
      } catch {}
    };
    checkConnection();
  }, []);

  return {
    wallet,
    connecting,
    error,
    availableWallets: detectWallets(),
    connect,
    disconnect,
    switchChain,
    refreshBalance,
  };
}

// Window type extensions
declare global {
  interface Window {
    ethereum?: any;
    phantom?: { solana?: any };
    solana?: any;
    solflare?: any;
  }
}
