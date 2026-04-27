# Polymer Bridge

A full-stack cross-chain native token bridge between **Base** (ETH) and **Plume** (PLUME) using Polymer's IBC protocol.

## Stack
- **Contracts**: Solidity + Hardhat (deployed on Base & Plume mainnets)
- **Backend**: Express + PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + wagmi v2 + RainbowKit

## Contract Addresses
- Base: `0x39d567809fc62Fa2e0cDCa322B22cBd07B8F5d14`
- Plume: `0x39d567809fc62Fa2e0cDCa322B22cBd07B8F5d14`

## Bridge Flow
1. Deposit native tokens on source chain
2. Polymer generates a cross-chain proof
3. Claim tokens on destination chain using the proof

See `replit.md` for full documentation.
