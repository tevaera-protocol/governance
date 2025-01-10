import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as dotenv from "dotenv";

dotenv.config();
const TevaMerkleDistributorV2 = require("../../artifacts/contracts/TevaMerkleDistributorV2.sol/TevaMerkleDistributorV2.json");
const TransparentUpgradeableProxy = require("../../artifacts/contracts/proxy/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json");

async function main(hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running deploy script for the upgradeable TevaMerkleDistributor contract with transparent proxy...`
  );

  // environment variables
  const base_rpc_provider_uri = process.env.BASE_RPC_PROVIDER_URI;
  if (!base_rpc_provider_uri) throw new Error("Please set Base provider url");
  const provider = new ethers.JsonRpcProvider(base_rpc_provider_uri);

  const proxyAdminContractAddress = process.env.BASE_PROXY_ADMIN_CONTRACT_ADDRESS;
  if (!proxyAdminContractAddress)
    throw new Error("Please set proxyAdminContractAddress");

  const tevaToken = process.env.TEVA_TOKEN_CONTRACT;
  if (!tevaToken) throw new Error("Please set teva token address");
  const merkelRoot = process.env.INVESTOR_MERKEL_ROOT;
  if (!merkelRoot) throw new Error("Please set merkel root");
  const maxClaimableAmount = process.env.INVESTOR_MAX_CLAIMABLE_LIMIT;
  if (!maxClaimableAmount) throw new Error("Pleae ste max claimable limit");
  const claimStart = process.env.CLAIM_START_TIME;
  if (!claimStart) throw new Error("Please set claim starting time");
  const claimEnd = process.env.CLAIM_END_TIME;
  if (!claimEnd) throw new Error("Please set claim end time");

  // Initialize the safeWallet.
  const proxyAdminWallet = new ethers.Wallet(
    `${process.env.PROXY_ADMIN_WALLET_PK}`,
    provider
  );
  console.log(
    "proxyAdminWallet address: ",
    await proxyAdminWallet.getAddress()
  );

  const contractAdminWallet = new ethers.Wallet(
    `${process.env.CONTRACT_ADMIN_WALLET_PK}`,
    provider
  );
  console.log(
    "contractAdminWallet address: ",
    await contractAdminWallet.getAddress()
  );

  // Initialize deployers

  const tevaMerkleDistributorArtifact = new ethers.ContractFactory(
    TevaMerkleDistributorV2.abi, TevaMerkleDistributorV2.bytecode, contractAdminWallet);

  const tevaMerkleDistributorArgs: any = [];

  const tevaMerkleDistributorContract = await tevaMerkleDistributorArtifact.deploy();
  await tevaMerkleDistributorContract.waitForDeployment();

  console.log(
    "args: " +
    tevaMerkleDistributorContract.interface.encodeDeploy(
      tevaMerkleDistributorArgs
    )
  );
  console.log(
    `tevaMerkleDistributor implementation was deployed to ${await tevaMerkleDistributorContract.getAddress()}`
  );

  //   verify contract
  try {
    await hre.run("verify:verify", {
      constract:"contracts/TevaMerkleDistributorV2.sol:TevaMerkleDistributorV2",
      address: await tevaMerkleDistributorContract.getAddress(),
      constructorArguments: tevaMerkleDistributorArgs
    });
  } catch (error: any) {
    if (error.name === "ContractVerificationInvalidStatusCodeError") {
      console.warn("Verification warning: Contract already verified or partially verified.");
    } else {
      console.error("Unexpected error during verification:", error);
    }
  }

  // Deploy the transparent proxy
  const transparentProxyConstArgs = [
    await tevaMerkleDistributorContract.getAddress(),
    proxyAdminContractAddress,
    "0x",
  ];

  const transparentUpgradeableProxyArtifact =
    new ethers.ContractFactory(TransparentUpgradeableProxy.abi, TransparentUpgradeableProxy.bytecode, contractAdminWallet);

  const transparentProxyContract = await transparentUpgradeableProxyArtifact.deploy(
    await tevaMerkleDistributorContract.getAddress(),
    proxyAdminContractAddress,
    "0x",
  );
  await transparentProxyContract.waitForDeployment();

  console.log(
    "transparentUpgradeableProxy deployed at:",
    await transparentProxyContract.getAddress()
  );

  try {
    await hre.run("verify:verify", {
      address: await transparentProxyContract.getAddress(),
      constructorArguments: transparentProxyConstArgs,
    });
  
  } catch (error: any) {
    if (error.name === "ContractVerificationInvalidStatusCodeError") {
      console.warn("Verification warning: Contract already verified or partially verified.");
    } else {
      console.error("Unexpected error during verification:", error);
    }
  }
  
  // Initializing TevaToken contract through proxy

  const nyContract = new ethers.Contract(
    await transparentProxyContract.getAddress(),
    TevaMerkleDistributorV2.abi,
    contractAdminWallet
  );

  const initializeMerkleDistributorTx = await nyContract.initialize(
    tevaToken,
    merkelRoot,
    ethers.parseEther(maxClaimableAmount),
    claimStart,
    claimEnd
  );
  await initializeMerkleDistributorTx.wait();
  console.log(
    "TevaMerkleDistributor initialization response: ",
    initializeMerkleDistributorTx
  );
}

main(require("hardhat")).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});