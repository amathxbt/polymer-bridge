import { useAccount, useWriteContract, useSwitchChain } from "wagmi";
import { formatEther } from "viem";
import { NativeBridgeABI } from "@/lib/abi";
import { base, plume } from "@/lib/chains";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  useGetBridgeTransactionsByAddress, 
  getGetBridgeTransactionsByAddressQueryKey,
  useGetBridgeContracts,
  getGetBridgeContractsQueryKey,
  useGetBridgeStats,
  getGetBridgeStatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function History() {
  const { address } = useAccount();
  const { switchChain } = useSwitchChain();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: txs, isLoading } = useGetBridgeTransactionsByAddress(address || "", {
    query: {
      queryKey: getGetBridgeTransactionsByAddressQueryKey(address || ""),
      enabled: !!address,
      refetchInterval: 5000,
    }
  });

  const { data: stats } = useGetBridgeStats(address || "", {
    query: {
      queryKey: getGetBridgeStatsQueryKey(address || ""),
      enabled: !!address,
    }
  });

  const { data: contracts } = useGetBridgeContracts({
    query: { queryKey: getGetBridgeContractsQueryKey() }
  });

  const { writeContractAsync: claim } = useWriteContract();

  const handleClaim = async (tx: any) => {
    if (!contracts || !tx.proof) return;
    
    const destChain = tx.destChainId === base.id ? base : plume;
    const destContract = tx.destChainId === base.id ? contracts.base.contractAddress : contracts.plume.contractAddress;

    if (destChain.id !== tx.destChainId) {
      switchChain({ chainId: tx.destChainId });
      return;
    }

    try {
      const hash = await claim({
        address: destContract as `0x${string}`,
        abi: NativeBridgeABI,
        functionName: "claim",
        args: [tx.proof as `0x${string}`],
      });

      toast({
        title: "Tokens claimed",
        description: `Transaction hash: ${hash}`,
      });

      queryClient.invalidateQueries({ queryKey: getGetBridgeTransactionsByAddressQueryKey(address || "") });
      queryClient.invalidateQueries({ queryKey: getGetBridgeStatsQueryKey(address || "") });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Claim failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  if (!address) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-xl text-muted-foreground">Connect your wallet to view history</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Your History</h2>
        <p className="text-muted-foreground">View and manage your cross-chain bridge transactions.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? formatEther(BigInt(stats.totalVolume)) : "0.0"} <span className="text-base font-normal text-muted-foreground">ETH</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingCount || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completedCount || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>Recent bridge activity for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !txs || txs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No transactions found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-sm">
                      {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{tx.srcChainId === base.id ? "Base" : "Plume"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{tx.destChainId === base.id ? "Base" : "Plume"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatEther(BigInt(tx.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        tx.status === "claimed" ? "default" :
                        tx.status === "proven" ? "secondary" :
                        "outline"
                      }>
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {tx.status === "proven" ? (
                        <Button size="sm" onClick={() => handleClaim(tx)}>Claim</Button>
                      ) : tx.status === "claimed" ? (
                        <Button size="sm" variant="ghost" disabled>Claimed</Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled>Wait...</Button>
                      )}
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
