# Polymer Bridge

## Overview

A cross-chain native token bridge between **Base Mainnet** (ETH) and **Plume Mainnet** (PLUME) using Polymer Labs' IBC protocol and CrossL2Prover infrastructure.

## Architecture

### How it works
1. User **deposits** native tokens on source chain — the `NativeBridge` contract locks them and emits a `Deposited` event
2. **Polymer's Prove API** generates a cryptographic proof that the event occurred on the source chain
3. User **submits the proof** on the destination chain — the contract verifies it via `ICrossL2ProverV2` and releases the corresponding native tokens

### CrossL2Prover
- Same contract on all mainnet chains: `0x95ccEAE71605c5d97A0AC0EA13013b058729d075`
- Polymer Prove API endpoint: `https://api.polymer.zone/v1/`
- API uses Bearer token authentication (`POLYMER_API_KEY`)

## Chain Info

| Chain | Chain ID | Native Token | RPC | Explorer |
|-------|----------|-------------|-----|---------|
| Base | 8453 | ETH | https://mainnet.base.org | https://basescan.org |
| Plume | 98866 | PLUME | https://rpc.plume.org | https://explorer.plume.org |

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + wagmi v2 + viem + RainbowKit v2
- **Smart contracts**: Solidity 0.8.20 + Hardhat

## Project Structure

```
artifacts/
  bridge/        # React + Vite frontend (Polymer Bridge UI)
  api-server/    # Express backend API

contracts/       # Hardhat smart contracts (NOT part of pnpm workspace)
  contracts/
    NativeBridge.sol         # Main bridge contract (deploy on both chains)
    interfaces/
      ICrossL2ProverV2.sol   # Polymer prover interface
  scripts/
    deploy.ts    # Deployment script
    set-peer.ts  # Configure peer bridge addresses after deployment
  deployments/
    addresses.json  # Stores deployed contract addresses

lib/
  api-spec/openapi.yaml  # OpenAPI spec (source of truth)
  api-client-react/      # Generated React Query hooks
  api-zod/               # Generated Zod schemas
  db/                    # PostgreSQL + Drizzle schema
```

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

### Contract Commands (run from `contracts/` directory)
- `npm run compile` — compile Solidity contracts
- `npm run deploy:base` — deploy NativeBridge to Base mainnet
- `npm run deploy:plume` — deploy NativeBridge to Plume mainnet
- After both deployed: run `npx hardhat run scripts/set-peer.ts --network base` and `--network plume`

## Deployment Checklist

1. Set secrets: `DEPLOYER_PRIVATE_KEY`, `POLYMER_API_KEY`, `VITE_WALLETCONNECT_PROJECT_ID`
2. Fund deployer wallet with ETH on Base and PLUME on Plume for gas
3. `cd contracts && npm run deploy:base`
4. `cd contracts && npm run deploy:plume`
5. `cd contracts && npx hardhat run scripts/set-peer.ts --network base`
6. `cd contracts && npx hardhat run scripts/set-peer.ts --network plume`
7. Update `BASE_BRIDGE_ADDRESS` and `PLUME_BRIDGE_ADDRESS` env vars with deployed addresses

## Required Secrets

| Secret | Description |
|--------|-------------|
| `DEPLOYER_PRIVATE_KEY` | Wallet private key for contract deployment |
| `POLYMER_API_KEY` | From https://dashboard.polymerlabs.org/ |
| `VITE_WALLETCONNECT_PROJECT_ID` | From https://cloud.walletconnect.com/ |

## Bridge Transaction Flow (detailed)

### Step 1: Deposit (source chain)
- User connects wallet, switches to source chain
- Calls `NativeBridge.deposit(recipient)` with native token value
- Gets back a tx hash

### Step 2: Request Proof (backend)
- `POST /api/bridge/request-proof` with `{txHash, srcChainId, blockNumber, globalLogIndex}`
- Backend calls Polymer Prove API and returns a `jobId`

### Step 3: Poll Proof
- `GET /api/bridge/proof-status/:jobId`
- When `status === "complete"`, proof (hex) is ready
- Proof is stored in DB automatically

### Step 4: Claim (destination chain)
- User switches wallet to dest chain
- Calls `NativeBridge.claim(proof)` 
- Contract verifies proof via CrossL2Prover and releases tokens

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bridge/contracts` | Contract addresses for both chains |
| GET | `/api/bridge/recent` | Recent transactions across all users |
| GET | `/api/bridge/transactions/:address` | Transactions for a wallet |
| GET | `/api/bridge/transactions/:address/stats` | Bridge stats for a wallet |
| POST | `/api/bridge/transactions` | Record a new bridge transaction |
| POST | `/api/bridge/request-proof` | Request Polymer proof for a deposit |
| GET | `/api/bridge/proof-status/:jobId` | Poll proof status |
