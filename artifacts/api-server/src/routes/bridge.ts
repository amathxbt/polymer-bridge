import { Router } from "express";
import { db } from "@workspace/db";
import { bridgeTransactionsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  CreateBridgeTransactionBody,
  RequestPolymerProofBody,
} from "@workspace/api-zod";
import axios from "axios";

const router = Router();

// Chain configuration
const BASE_CHAIN_ID = 8453;
const PLUME_CHAIN_ID = 98866;
const CROSS_L2_PROVER = "0x95ccEAE71605c5d97A0AC0EA13013b058729d075";
const POLYMER_API_URL = "https://api.polymer.zone/v1/";

const BASE_BRIDGE_ADDRESS = process.env.BASE_BRIDGE_ADDRESS || "";
const PLUME_BRIDGE_ADDRESS = process.env.PLUME_BRIDGE_ADDRESS || "";
const POLYMER_API_KEY = process.env.POLYMER_API_KEY || "";

// GET /bridge/contracts
router.get("/contracts", async (req, res) => {
  res.json({
    base: {
      chainId: BASE_CHAIN_ID,
      contractAddress: BASE_BRIDGE_ADDRESS,
      rpcUrl: "https://mainnet.base.org",
      explorerUrl: "https://basescan.org",
    },
    plume: {
      chainId: PLUME_CHAIN_ID,
      contractAddress: PLUME_BRIDGE_ADDRESS,
      rpcUrl: "https://rpc.plume.org",
      explorerUrl: "https://explorer.plume.org",
    },
    polymerProver: CROSS_L2_PROVER,
  });
});

// GET /bridge/recent
router.get("/recent", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const txs = await db
      .select()
      .from(bridgeTransactionsTable)
      .orderBy(desc(bridgeTransactionsTable.createdAt))
      .limit(limit);
    res.json(txs);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch recent transactions");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch transactions" });
  }
});

// GET /bridge/transactions/:address
router.get("/transactions/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const normalizedAddress = address.toLowerCase();
    const txs = await db
      .select()
      .from(bridgeTransactionsTable)
      .where(eq(sql`lower(${bridgeTransactionsTable.sender})`, normalizedAddress))
      .orderBy(desc(bridgeTransactionsTable.createdAt));
    res.json(txs);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch transactions by address");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch transactions" });
  }
});

// GET /bridge/transactions/:address/stats
router.get("/transactions/:address/stats", async (req, res) => {
  try {
    const { address } = req.params;
    const normalizedAddress = address.toLowerCase();
    const txs = await db
      .select()
      .from(bridgeTransactionsTable)
      .where(eq(sql`lower(${bridgeTransactionsTable.sender})`, normalizedAddress));

    const stats = {
      totalTransactions: txs.length,
      totalVolume: txs.reduce((sum, tx) => sum + BigInt(tx.amount), BigInt(0)).toString(),
      pendingCount: txs.filter((t) => ["pending", "proving"].includes(t.status)).length,
      completedCount: txs.filter((t) => t.status === "claimed").length,
      baseToPlume: txs.filter((t) => t.srcChainId === BASE_CHAIN_ID).length,
      plumeToBase: txs.filter((t) => t.srcChainId === PLUME_CHAIN_ID).length,
    };

    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Failed to get bridge stats");
    res.status(500).json({ error: "internal_error", message: "Failed to get stats" });
  }
});

// POST /bridge/transactions
router.post("/transactions", async (req, res) => {
  const parsed = CreateBridgeTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  try {
    const data = parsed.data;
    const [tx] = await db
      .insert(bridgeTransactionsTable)
      .values({
        txHash: data.txHash,
        srcChainId: data.srcChainId,
        destChainId: data.destChainId,
        sender: data.sender.toLowerCase(),
        recipient: data.recipient.toLowerCase(),
        amount: data.amount,
        nonce: data.nonce,
        status: "pending",
        blockNumber: data.blockNumber ?? null,
        logIndex: data.logIndex ?? null,
        globalLogIndex: data.globalLogIndex ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (!tx) {
      const existing = await db
        .select()
        .from(bridgeTransactionsTable)
        .where(eq(bridgeTransactionsTable.txHash, data.txHash))
        .limit(1);
      res.status(201).json(existing[0]);
      return;
    }

    res.status(201).json(tx);
  } catch (err) {
    req.log.error({ err }, "Failed to create bridge transaction");
    res.status(500).json({ error: "internal_error", message: "Failed to record transaction" });
  }
});

// POST /bridge/request-proof
router.post("/request-proof", async (req, res) => {
  const parsed = RequestPolymerProofBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { txHash, srcChainId, blockNumber, globalLogIndex } = parsed.data;

  if (!POLYMER_API_KEY) {
    res.status(503).json({
      error: "configuration_error",
      message: "POLYMER_API_KEY not configured",
    });
    return;
  }

  try {
    const response = await axios.post(
      POLYMER_API_URL,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "proof_request",
        params: [{ srcChainId, srcBlockNumber: blockNumber, globalLogIndex }],
      },
      {
        headers: {
          Authorization: `Bearer ${POLYMER_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    const jobId = String(response.data.result);

    // Update the transaction status to proving
    await db
      .update(bridgeTransactionsTable)
      .set({ status: "proving", polymerJobId: jobId, updatedAt: new Date() })
      .where(eq(bridgeTransactionsTable.txHash, txHash));

    res.json({ jobId, txHash, status: "pending" });
  } catch (err: any) {
    req.log.error({ err }, "Failed to request Polymer proof");
    const message = err.response?.data?.error?.message || err.message || "Failed to request proof";
    res.status(500).json({ error: "polymer_error", message });
  }
});

// GET /bridge/proof-status/:jobId
router.get("/proof-status/:jobId", async (req, res) => {
  const { jobId } = req.params;

  if (!POLYMER_API_KEY) {
    res.status(503).json({
      error: "configuration_error",
      message: "POLYMER_API_KEY not configured",
    });
    return;
  }

  try {
    const response = await axios.post(
      POLYMER_API_URL,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "proof_query",
        params: [jobId],
      },
      {
        headers: {
          Authorization: `Bearer ${POLYMER_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const result = response.data.result;
    const status = result?.status || "pending";

    let proof: string | null = null;
    if (status === "complete" && result?.proof) {
      // Polymer returns base64-encoded proof; convert to hex for on-chain submission
      const proofBuffer = Buffer.from(result.proof, "base64");
      proof = "0x" + proofBuffer.toString("hex");

      // Update the tx record with the proof
      await db
        .update(bridgeTransactionsTable)
        .set({ status: "proven", proof, updatedAt: new Date() })
        .where(eq(bridgeTransactionsTable.polymerJobId, jobId));
    }

    res.json({ jobId, status, proof });
  } catch (err: any) {
    req.log.error({ err }, "Failed to query Polymer proof status");
    const message = err.response?.data?.error?.message || err.message || "Failed to query proof";
    res.status(500).json({ error: "polymer_error", message });
  }
});

export default router;
