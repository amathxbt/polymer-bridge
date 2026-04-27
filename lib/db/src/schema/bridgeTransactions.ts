import { pgTable, serial, text, integer, timestamp, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bridgeTransactionsTable = pgTable("bridge_transactions", {
  id: serial("id").primaryKey(),
  txHash: text("tx_hash").notNull().unique(),
  srcChainId: integer("src_chain_id").notNull(),
  destChainId: integer("dest_chain_id").notNull(),
  sender: text("sender").notNull(),
  recipient: text("recipient").notNull(),
  amount: text("amount").notNull(),
  nonce: text("nonce").notNull(),
  status: text("status").notNull().default("pending"),
  blockNumber: integer("block_number"),
  logIndex: integer("log_index"),
  globalLogIndex: integer("global_log_index"),
  polymerJobId: text("polymer_job_id"),
  proof: text("proof"),
  claimTxHash: text("claim_tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBridgeTransactionSchema = createInsertSchema(bridgeTransactionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBridgeTransaction = z.infer<typeof insertBridgeTransactionSchema>;
export type BridgeTransaction = typeof bridgeTransactionsTable.$inferSelect;
