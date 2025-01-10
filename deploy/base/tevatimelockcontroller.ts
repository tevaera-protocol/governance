import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as dotenv from "dotenv";

dotenv.config();
const TransparentUpgradeableProxy = require("../../artifacts/contracts/proxy/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json");
const TeveTimelockControllerV1 = require("../../artifacts/contracts/TeveTimelockControllerV1.sol/TeveTimelockControllerV1.json");
// An example of a deploy script that will deploy and call a simple contract.
async function main(hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running deploy script for the upgradable TeveTimelockController contract with transparent proxy...`
  );

  // environment variables
  const base_rpc_provider_uri = process.env.BASE_RPC_PROVIDER_URI;
  if (!base_rpc_provider_uri) throw new Error("Please set Base provider url");
  const provider = new ethers.JsonRpcProvider(base_rpc_provider_uri);

  const proxyAdminContractAddress = process.env.BASE_PROXY_ADMIN_CONTRACT_ADDRESS;
  if (!proxyAdminContractAddress)
    throw new Error("Please set proxyAdminContractAddress");

  const teveTimelockDelay = process.env.TEVA_TIMELOCK_EXECUTION_DELAY;
  if (!teveTimelockDelay) throw new Error("Please set TEVA_TIMELOCK_EXECUTION_DELAY address");
  const minDelay = BigInt(teveTimelockDelay);

  let proposalAddressArray = process.env.PROPOSERS_ADDRESS_ARRAY;
  if (!proposalAddressArray) throw new Error("Please set PROPOSERS_ADDRESS_ARRAY ");
  proposalAddressArray = JSON.parse(proposalAddressArray);

  let executorAddressArray = process.env.EXECUTORS_ADDRESS_ARRAY;
  if (!executorAddressArray) throw new Error("Pleae set EXECUTORS_ADDRESS_ARRAY");
  executorAddressArray = JSON.parse(executorAddressArray);

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


  // Deploy the Teva Time Lock contract
  const TeveTimelockControllerArtifact = new ethers.ContractFactory(
    TeveTimelockControllerV1.abi,TeveTimelockControllerV1.bytecode,contractAdminWallet
  );
  const TeveTimelockControllerConstArgs:any = [];
  const TeveTimelockControllerContract = await TeveTimelockControllerArtifact.deploy();
  await TeveTimelockControllerContract.waitForDeployment();

  console.log(
    "args: " +
    TeveTimelockControllerContract.interface.encodeDeploy(TeveTimelockControllerConstArgs)
  );
  console.log(
    `TeveTimelockController was deployed to ${await TeveTimelockControllerContract.getAddress()}`
  );

  try {
    await hre.run("verify:verify", {
      address: await TeveTimelockControllerContract.getAddress(),
      constructorArguments: TeveTimelockControllerConstArgs,
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
    await TeveTimelockControllerContract.getAddress(),
    proxyAdminContractAddress,
    "0x",
  ];
  const transparentUpgradeableProxyFactory = new ethers.ContractFactory(
    TransparentUpgradeableProxy.abi,
    TransparentUpgradeableProxy.bytecode,
    proxyAdminWallet
  );
  const transparentProxyContract =
    await transparentUpgradeableProxyFactory.deploy(
      await TeveTimelockControllerContract.getAddress(),
      proxyAdminContractAddress,
      "0x"
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

  // Initializing TeveTimelockController contract through proxy

  const nyContract = new ethers.Contract(
    await transparentProxyContract.getAddress(),
    TeveTimelockControllerV1.abi,
    contractAdminWallet
  );

  const initializeTeveTimelockControllerTx = await nyContract.initialize(minDelay, proposalAddressArray, executorAddressArray);
  await initializeTeveTimelockControllerTx.wait();
  console.log("TeveTimelockController initialization response: ", initializeTeveTimelockControllerTx);
}

main(require("hardhat")).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});