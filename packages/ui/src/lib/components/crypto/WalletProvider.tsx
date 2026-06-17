/**
 * WalletProvider — Wraps app with Wagmi + React Query
 * Fails gracefully if wagmi/reown can't initialize
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { useState, useEffect, ReactNode } from "react";
import { getWagmiConfig } from "../../config/reown";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const cfg = getWagmiConfig();
      setConfig(cfg);
    } catch (e) {
      console.warn("[WalletProvider] Failed to get wagmi config:", e);
    }
    setReady(true);
  }, []);

  if (!ready) return <>{children}</>;
  if (!config) return <>{children}</>;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
