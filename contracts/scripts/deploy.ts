import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Polymer CrossL2Prover - same on all mainnet chains
const CROSS_L2_PROVER = "0x95ccEAE71605c5d97A0AC0EA13013b058729d075";

// Chain configurations
const CHAIN_CONFIG: Record<string, { chainId: number; peerChainId: number; peerName: string }> = {
  base: { chainId: 8453, peerChainId: 98866, peerName: "plume" },
  plume: { chainId: 98866, peerChainId: 8453, peerName: "base" },
};

async function main() {
  const networkName = network.name;
  console.log(`\nDeploying NativeBridge to ${networkName}...`);

  const config = CHAIN_CONFIG[networkName];
  if (!config) {
    throw new Error(`Unknown network: ${networkName}. Use --network base or --network plume`);
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  // Load peer bridge address if already deployed
  const deploymentsPath = path.join(__dirname, "../deployments/addresses.json");
  let deployments: Record<string, string> = {};
  if (fs.existsSync(deploymentsPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  }

  const peerBridgeAddress = deployments[config.peerName] || ethers.ZeroAddress;
  console.log(
    peerBridgeAddress === ethers.ZeroAddress
      ? `No peer bridge deployed yet on ${config.peerName}. You'll need to call setPeerBridge() after deployment.`
      : `Peer bridge on ${config.peerName}: ${peerBridgeAddress}`
  );

  // Deploy contract
  const NativeBridge = await ethers.getContractFactory("NativeBridge");
  const bridge = await NativeBridge.deploy(
    CROSS_L2_PROVER,
    peerBridgeAddress,
    config.peerChainId
  );

  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();

  console.log(`\nNativeBridge deployed to: ${bridgeAddress}`);
  console.log(`Transaction hash: ${bridge.deploymentTransaction()?.hash}`);

  // Save deployment
  deployments[networkName] = bridgeAddress;
  fs.mkdirSync(path.dirname(deploymentsPath), { recursive: true });
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));

  console.log(`\nDeployment saved to: ${deploymentsPath}`);
  console.log(`\nNext steps:`);

  if (peerBridgeAddress === ethers.ZeroAddress) {
    console.log(`1. Deploy to ${config.peerName} using: pnpm deploy:${config.peerName}`);
    console.log(
      `2. Call setPeerBridge(${config.peerName}_address) on the ${networkName} contract`
    );
  } else {
    console.log(`Deployment complete! Both chains are configured.`);
    console.log(`Base bridge: ${deployments["base"] || "not yet"}`);
    console.log(`Plume bridge: ${deployments["plume"] || "not yet"}`);
  }

  // If peer is already deployed, update them to reference each other
  if (peerBridgeAddress !== ethers.ZeroAddress) {
    console.log("\nBoth contracts deployed. Please update the backend env vars with addresses:");
    console.log(`BASE_BRIDGE_ADDRESS=${deployments["base"]}`);
    console.log(`PLUME_BRIDGE_ADDRESS=${deployments["plume"]}`);
  }

  return bridgeAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
