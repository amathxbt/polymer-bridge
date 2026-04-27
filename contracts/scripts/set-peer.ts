import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * After deploying to both chains, run this script on each chain
 * to configure the peer bridge addresses.
 */
async function main() {
  const networkName = network.name;
  const deploymentsPath = path.join(__dirname, "../deployments/addresses.json");

  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("No deployments found. Deploy to both chains first.");
  }

  const deployments: Record<string, string> = JSON.parse(
    fs.readFileSync(deploymentsPath, "utf-8")
  );

  const peerName = networkName === "base" ? "plume" : "base";
  const myAddress = deployments[networkName];
  const peerAddress = deployments[peerName];

  if (!myAddress) throw new Error(`${networkName} bridge not deployed yet`);
  if (!peerAddress) throw new Error(`${peerName} bridge not deployed yet`);

  console.log(`Setting peer bridge on ${networkName}...`);
  console.log(`My address: ${myAddress}`);
  console.log(`Peer address (${peerName}): ${peerAddress}`);

  const [deployer] = await ethers.getSigners();
  const NativeBridge = await ethers.getContractFactory("NativeBridge");
  const bridge = NativeBridge.attach(myAddress).connect(deployer) as any;

  const tx = await bridge.setPeerBridge(peerAddress);
  console.log(`Transaction: ${tx.hash}`);
  await tx.wait();
  console.log(`Peer bridge set successfully!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
