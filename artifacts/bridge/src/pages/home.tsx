import { useState, useEffect, useRef } from "react";
import { useAccount, useWriteContract, usePublicClient, useSwitchChain } from "wagmi";
import { base, plume, DEPOSITED_TOPIC } from "@/lib/chains";
import { NativeBridgeABI } from "@/lib/abi";
import { parseEther, formatEther } from "viem";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownUp, CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import { 
  useGetBridgeContracts, 
  getGetBridgeContractsQueryKey,
  useCreateBridgeTransaction,
  useRequestPolymerProof,
  useGetProofStatus,
  getGetProofStatusQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function Home() {
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();
  
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"base-to-plume" | "plume-to-base">("base-to-plume");
  
  const { data: contracts } = useGetBridgeContracts({
    query: { queryKey: getGetBridgeContractsQueryKey() }
  });

  const { writeContractAsync: deposit } = useWriteContract();
  const { writeContractAsync: claim } = useWriteContract();
  
  const createTx = useCreateBridgeTransaction();
  const requestProof = useRequestPolymerProof();
  
  const [activeTxHash, setActiveTxHash] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "depositing" | "proving" | "claiming" | "done">("idle");
  const [proofData, setProofData] = useState<string | null>(null);

  const srcChain = direction === "base-to-plume" ? base : plume;
  const destChain = direction === "base-to-plume" ? plume : base;

  // Poll proof status
  const { data: proofStatus } = useGetProofStatus(activeJobId || "", {
    query: {
      queryKey: getGetProofStatusQueryKey(activeJobId || ""),
      enabled: !!activeJobId && step === "proving",
      refetchInterval: 3000,
    }
  });

  useEffect(() => {
    if (proofStatus?.status === "complete" && proofStatus.proof) {
      setProofData(proofStatus.proof);
      setStep("claiming");
    }
  }, [proofStatus]);

  const handleDeposit = async () => {
    if (!address || !contracts || !amount || !publicClient) return;
    if (chainId !== srcChain.id) {
      switchChain({ chainId: srcChain.id });
      return;
    }

    try {
      setStep("depositing");
      const srcContract = direction === "base-to-plume" ? contracts.base.contractAddress : contracts.plume.contractAddress;
      const parsedAmount = parseEther(amount);

      const txHash = await deposit({
        address: srcContract as `0x${string}`,
        abi: NativeBridgeABI,
        functionName: "deposit",
        args: [address],
        value: parsedAmount,
      });

      setActiveTxHash(txHash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      const log = receipt.logs.find(
        (l) => l.address.toLowerCase() === srcContract.toLowerCase() && l.topics[0] === DEPOSITED_TOPIC
      );

      if (!log) throw new Error("Deposit event not found");

      await createTx.mutateAsync({
        data: {
          txHash,
          srcChainId: srcChain.id,
          destChainId: destChain.id,
          sender: address,
          recipient: address,
          amount: parsedAmount.toString(),
          nonce: "0",
          blockNumber: Number(receipt.blockNumber),
          globalLogIndex: log.logIndex,
        }
      });

      setStep("proving");

      const proofJob = await requestProof.mutateAsync({
        data: {
          txHash,
          srcChainId: srcChain.id,
          blockNumber: Number(receipt.blockNumber),
          globalLogIndex: log.logIndex,
        }
      });

      setActiveJobId(proofJob.jobId);

    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Deposit failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
      setStep("idle");
    }
  };

  const handleClaim = async () => {
    if (!address || !contracts || !proofData) return;
    if (chainId !== destChain.id) {
      switchChain({ chainId: destChain.id });
      return;
    }

    try {
      const destContract = direction === "base-to-plume" ? contracts.plume.contractAddress : contracts.base.contractAddress;
      
      const txHash = await claim({
        address: destContract as `0x${string}`,
        abi: NativeBridgeABI,
        functionName: "claim",
        args: [proofData as `0x${string}`],
      });

      toast({
        title: "Tokens claimed",
        description: `Transaction hash: ${txHash}`,
      });

      setStep("done");
      setAmount("");
      setActiveTxHash(null);
      setActiveJobId(null);
      setProofData(null);
      setTimeout(() => setStep("idle"), 3000);

    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Claim failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tighter">Polymer Bridge</h1>
          <p className="text-muted-foreground text-lg">Fast, secure IBC transfers between Base and Plume.</p>
        </div>

        <Card className="w-full border-primary/20 shadow-2xl shadow-primary/5">
          <CardHeader>
            <CardTitle>Transfer Native Tokens</CardTitle>
            <CardDescription>Move tokens across networks seamlessly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-2 relative">
              <div className="p-4 rounded-xl border bg-card/50 flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">From</Label>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 font-medium text-lg">
                    {srcChain.name}
                  </div>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={step !== "idle"}
                    className="w-1/2 text-right text-xl font-mono border-none shadow-none focus-visible:ring-0 px-0 bg-transparent"
                  />
                </div>
              </div>

              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full bg-background shadow-md border-border hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    if (step === "idle") {
                      setDirection(direction === "base-to-plume" ? "plume-to-base" : "base-to-plume");
                    }
                  }}
                  disabled={step !== "idle"}
                >
                  <ArrowDownUp className="h-4 w-4" />
                </Button>
              </div>

              <div className="p-4 rounded-xl border bg-card/50 flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">To</Label>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 font-medium text-lg">
                    {destChain.name}
                  </div>
                  <div className="w-1/2 text-right text-xl font-mono text-muted-foreground">
                    {amount || "0.0"}
                  </div>
                </div>
              </div>
            </div>

            {step !== "idle" && (
              <div className="flex items-center justify-between px-2 pt-2">
                <Step 
                  active={step === "depositing"} 
                  done={["proving", "claiming", "done"].includes(step)} 
                  label="Deposit" 
                />
                <div className="flex-1 h-px bg-border mx-2" />
                <Step 
                  active={step === "proving"} 
                  done={["claiming", "done"].includes(step)} 
                  label="Proof" 
                />
                <div className="flex-1 h-px bg-border mx-2" />
                <Step 
                  active={step === "claiming"} 
                  done={step === "done"} 
                  label="Claim" 
                />
              </div>
            )}
          </CardContent>
          <CardFooter>
            {!address ? (
              <Button className="w-full h-14 text-lg font-medium" disabled>
                Connect Wallet
              </Button>
            ) : step === "idle" ? (
              <Button 
                className="w-full h-14 text-lg font-medium"
                onClick={handleDeposit}
                disabled={!amount || Number(amount) <= 0 || !contracts}
              >
                {chainId !== srcChain.id ? `Switch to ${srcChain.name}` : "Review Bridge"}
              </Button>
            ) : step === "depositing" ? (
              <Button className="w-full h-14 text-lg font-medium" disabled>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Confirming Deposit...
              </Button>
            ) : step === "proving" ? (
              <Button className="w-full h-14 text-lg font-medium" disabled>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating Proof...
              </Button>
            ) : step === "claiming" ? (
              <Button 
                className="w-full h-14 text-lg font-medium" 
                onClick={handleClaim}
              >
                {chainId !== destChain.id ? `Switch to ${destChain.name}` : "Claim Tokens"}
              </Button>
            ) : (
              <Button className="w-full h-14 text-lg font-medium bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="mr-2 h-5 w-5" /> Bridge Complete
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function Step({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
        done ? "bg-primary text-primary-foreground" : 
        active ? "bg-primary/20 text-primary animate-pulse border border-primary/30" : 
        "bg-muted text-muted-foreground"
      }`}>
        {done ? <CheckCircle2 className="h-5 w-5" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDashed className="h-4 w-4" />}
      </div>
      <span className={`text-xs font-medium ${active || done ? "text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}
