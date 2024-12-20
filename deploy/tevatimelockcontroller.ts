import { Contract, ContractFactory, Provider, Wallet } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as dotenv from "dotenv";

dotenv.config();
const TransparentUpgradeableProxy = require("../artifacts-zk/contracts/proxy/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json");

// Note : Initialize, Replace minDelay, proposers and executors as per requirement
const MIN_DELAY = BigInt(process.env.TEVA_TIMELOCK_EXECUTION_DELAY); // 1 days
const PROPOSERS_ADDRESS_ARRAY = JSON.parse(process.env.PROPOSERS_ADDRESS_ARRAY);  // proposers address array
const EXECUTORS_ADDRESS_ARRAY = JSON.parse(process.env.EXECUTORS_ADDRESS_ARRAY); // executors address array
console.log("PROPOSERS_ADDRESS_ARRAY", PROPOSERS_ADDRESS_ARRAY);
console.log("EXECUTORS_ADDRESS_ARRAY", EXECUTORS_ADDRESS_ARRAY);

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running deploy script for the upgradable TeveTimelockController contract with transparent proxy...`
  );

  // environment variables
  const provider = new Provider(process.env.ZKSYNC_PROVIDER_URI);
  if (!provider) throw new Error("Please set zksync provider url");
  const proxyAdminContractAddress = process.env.PROXY_ADMIN_CONTRACT_ADDRESS;
  if (!proxyAdminContractAddress)
    throw new Error("Please set proxyAdminContractAddress");

  // Initialize the safeWallet.
  const proxyAdminWallet = new Wallet(
    `${process.env.PROXY_ADMIN_WALLET_PK}`,
    provider
  );
  console.log(
    "proxyAdminWallet address: ",
    await proxyAdminWallet.getAddress()
  );

  const contractAdminWallet = new Wallet(
    `${process.env.CONTRACT_ADMIN_WALLET_PK}`,
    provider
  );
  console.log(
    "contractAdminWallet address: ",
    await contractAdminWallet.getAddress()
  );

  // Initialize deployers
  const contractDeployer = new Deployer(hre, contractAdminWallet);

  // Deploy the simplifier kraken contract
  const TeveTimelockControllerArtifact = await contractDeployer.loadArtifact(
    "contracts/TeveTimelockControllerV1.sol:TeveTimelockControllerV1"
  );
  const TeveTimelockControllerConstArgs = [];
  const TeveTimelockControllerContract = await contractDeployer.deploy(
    TeveTimelockControllerArtifact,
    TeveTimelockControllerConstArgs
  );
  console.log(
    "args: " +
    TeveTimelockControllerContract.interface.encodeDeploy(TeveTimelockControllerConstArgs)
  );
  console.log(
    `TeveTimelockController was deployed to ${await TeveTimelockControllerContract.getAddress()}`
  );

  const verifyTeveTimelockController = await hre.run("verify:verify", {
    address: await TeveTimelockControllerContract.getAddress(),
    constructorArguments: TeveTimelockControllerConstArgs,
  });

  console.log("Verification res: ", verifyTeveTimelockController);

  // Deploy the transparent proxy
  const transparentProxyConstArgs = [
    await TeveTimelockControllerContract.getAddress(),
    proxyAdminContractAddress,
    "0x",
  ];
  const transparentUpgradeableProxyFactory = new ContractFactory(
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

  const verifyProxy = await hre.run("verify:verify", {
    address: await transparentProxyContract.getAddress(),
    constructorArguments: transparentProxyConstArgs,
  });

  console.log("Verification res: ", verifyProxy);

  // Initializing TeveTimelockController contract through proxy
  const NY_JSON = require("../artifacts-zk/contracts//TeveTimelockControllerV1.sol/TeveTimelockControllerV1.json");
  const NY_ABI = NY_JSON.abi;

  const nyContract = new Contract(
    await transparentProxyContract.getAddress(),
    NY_ABI,
    contractAdminWallet._signerL2()
  );

  const initializeTeveTimelockControllerTx = await nyContract.initialize(MIN_DELAY, PROPOSERS_ADDRESS_ARRAY, EXECUTORS_ADDRESS_ARRAY);
  await initializeTeveTimelockControllerTx.wait();
  console.log("TeveTimelockController initialization response: ", initializeTeveTimelockControllerTx);
}