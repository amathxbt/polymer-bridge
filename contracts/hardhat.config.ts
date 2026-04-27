import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });
dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const PLUME_RPC_URL = process.env.PLUME_RPC_URL || "https://rpc.plume.org";

if (!DEPLOYER_PRIVATE_KEY && process.env.NODE_ENV !== "test") {
  console.warn("Warning: DEPLOYER_PRIVATE_KEY not set. Deployment will fail.");
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    base: {
      url: BASE_RPC_URL,
      chainId: 8453,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
    plume: {
      url: PLUME_RPC_URL,
      chainId: 98866,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY || "",
      plume: "no-api-key-needed",
    },
    customChains: [
      {
        network: "plume",
        chainId: 98866,
        urls: {
          apiURL: "https://explorer.plume.org/api",
          browserURL: "https://explorer.plume.org",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
