import { type Chain } from "viem";
import { base } from "wagmi/chains";

export const plume = {
  id: 98866,
  name: "Plume",
  nativeCurrency: { name: "PLUME", symbol: "PLUME", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.plume.org"] },
    public: { http: ["https://rpc.plume.org"] },
  },
  blockExplorers: {
    default: { name: "Plume Explorer", url: "https://explorer.plume.org" },
  },
} as const satisfies Chain;

export { base };

export const DEPOSITED_TOPIC = "0xe602b93ebf3fb6eb655f448c3b291d9600a5d2cb4d3f57bc86e08ddde01f9bb9";
