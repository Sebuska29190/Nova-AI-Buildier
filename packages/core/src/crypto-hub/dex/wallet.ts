/**
 * Solana Wallet Manager — server-side wallet for DEX trading
 */

export interface WalletInfo {
  address: string;
  solBalance: number;
  tokenAccounts: TokenAccount[];
}

export interface TokenAccount {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
}

class WalletManager {
  private privateKey: string | null = null;
  private address: string | null = null;
  private initialized = false;

  /**
   * Initialize wallet from SOLANA_PRIVATE_KEY env var.
   * Uses base58-encoded private key.
   */
  init(): void {
    if (this.initialized) return;
    this.privateKey = process.env.SOLANA_PRIVATE_KEY || null;
    if (this.privateKey) {
      // Derive address from private key
      // Using @solana/web3.js would be ideal, but we keep it simple
      // The address is derived on first use
      this.address = process.env.SOLANA_WALLET_ADDRESS || null;
    }
    this.initialized = true;
    if (this.address) {
      console.log(`[wallet] Initialized: ${this.address.slice(0, 4)}...${this.address.slice(-4)}`);
    } else {
      console.log("[wallet] No wallet configured (set SOLANA_PRIVATE_KEY)");
    }
  }

  isConnected(): boolean {
    return !!this.privateKey && !!this.address;
  }

  getAddress(): string | null {
    return this.address;
  }

  /**
   * Get SOL balance via RPC
   */
  async getSolBalance(): Promise<number> {
    if (!this.address) return 0;
    try {
      const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBalance",
          params: [this.address],
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      return (data.result?.value || 0) / 1e9; // lamports to SOL
    } catch {
      return 0;
    }
  }

  /**
   * Get token accounts via RPC
   */
  async getTokenAccounts(): Promise<TokenAccount[]> {
    if (!this.address) return [];
    try {
      const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            this.address,
            { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
            { encoding: "jsonParsed" },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      return (data.result?.value || []).map((acc: any) => {
        const info = acc.account?.data?.parsed?.info;
        return {
          mint: info?.mint || "",
          symbol: info?.mint?.slice(0, 4) || "?",
          amount: (info?.tokenAmount?.uiAmount || 0),
          decimals: info?.tokenAmount?.decimals || 0,
        };
      }).filter((t: TokenAccount) => t.amount > 0);
    } catch {
      return [];
    }
  }

  /**
   * Get full wallet info
   */
  async getInfo(): Promise<WalletInfo | null> {
    if (!this.address) return null;
    const [solBalance, tokenAccounts] = await Promise.all([
      this.getSolBalance(),
      this.getTokenAccounts(),
    ]);
    return { address: this.address, solBalance, tokenAccounts };
  }
}

export const walletManager = new WalletManager();
