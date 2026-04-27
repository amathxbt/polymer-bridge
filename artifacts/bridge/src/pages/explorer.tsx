import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEther } from "viem";
import { base } from "@/lib/chains";
import { Loader2 } from "lucide-react";
import { 
  useGetRecentBridgeTransactions,
  getGetRecentBridgeTransactionsQueryKey
} from "@workspace/api-client-react";

export function Explorer() {
  const { data: txs, isLoading } = useGetRecentBridgeTransactions({ limit: 50 }, {
    query: {
      queryKey: getGetRecentBridgeTransactionsQueryKey({ limit: 50 }),
      refetchInterval: 10000,
    }
  });

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const truncateHash = (hash: string) => `${hash.slice(0, 8)}...${hash.slice(-6)}`;

  return (
    <div className="space-y-8 w-full">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Network Explorer</h2>
        <p className="text-muted-foreground">Live bridge activity across all users on Polymer.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest bridge transfers across Base and Plume.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !txs || txs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No transactions found on the network.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Tx Hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(tx.createdAt).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-primary">
                      {truncateAddress(tx.sender)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{tx.srcChainId === base.id ? "Base" : "Plume"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{tx.destChainId === base.id ? "Base" : "Plume"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatEther(BigInt(tx.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        tx.status === "claimed" ? "default" :
                        tx.status === "proven" ? "secondary" :
                        "outline"
                      } className="capitalize">
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {truncateHash(tx.txHash)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
