import { Contract, ContractFactory, Provider, Wallet } from "zksync-ethers";
import { Interface } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as dotenv from "dotenv";
const ethers = require("ethers");

dotenv.config();
const TransparentUpgradeableProxy = require("../artifacts-zk/contracts/proxy/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json");

// Note: Initialize and replace TEVA_TOKEN_CONTRACT_ADDRESS, TEVA_TIMELOCK_CONTRACT_ADDRESS from env
//  TEVA_VOTING_DELAY, TEVA_VOTING_PERIOD, TEVA_PROPOSAL_THRESHOLD,
//  and TEVA_QUORUM_PERCENTAGE with actual values as per the project requirements.
const TEVA_TOKEN_CONTRACT = process.env.TEVA_TOKEN_CONTRACT; // Teva Token Contract Address
const TEVA_TIMELOCK_CONTRACT_ADDRESS = process.env.TEVA_TIMELOCK_CONTRACT_ADDRESS;  // Teva Time lockController Address
const TEVA_VOTING_DELAY = 300n;   // Number of blocks in between
const TEVA_VOTING_PERIOD = 604800n;  // Numbers of blocks in between when voting remains valid  
const TEVA_PROPOSAL_THRESHOLD = ethers.parseUnits("1000", 18); // Token value :1000
const TEVA_QUORUM_PERCENTAGE = 4n; // quorum percentage

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running deploy script for the upgradable TevaGovernor contract with transparent proxy...`
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
  const TevaGovernorArtifact = await contractDeployer.loadArtifact(
    "contracts/TevaGovernorV1.sol:TevaGovernorV1"
  );
  const TevaGovernorConstArgs = [];
  const TevaGovernorContract = await contractDeployer.deploy(
    TevaGovernorArtifact,
    TevaGovernorConstArgs
  );
  console.log(
    "args: " +
    TevaGovernorContract.interface.encodeDeploy(TevaGovernorConstArgs)
  );
  console.log(
    `TevaGovernor was deployed to ${await TevaGovernorContract.getAddress()}`
  );

  const verifyTevaGovernor = await hre.run("verify:verify", {
    address: await TevaGovernorContract.getAddress(),
    constructorArguments: TevaGovernorConstArgs,
  });

  console.log("Verification res: ", verifyTevaGovernor);

  // Deploy the transparent proxy
  const transparentProxyConstArgs = [
    await TevaGovernorContract.getAddress(),
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
      await TevaGovernorContract.getAddress(),
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

  // Initializing TevaGovernor contract through proxy
  const NY_JSON = require("../artifacts-zk/contracts/TevaGovernorV1.sol/TevaGovernorV1.json");
  const NY_ABI = NY_JSON.abi;

  const nyContract = new Contract(
    await transparentProxyContract.getAddress(),
    NY_ABI,
    contractAdminWallet._signerL2()
  );
  
  const initializeTevaGovernorTx = await nyContract.initialize(TEVA_TOKEN_CONTRACT, TEVA_TIMELOCK_CONTRACT_ADDRESS, TEVA_VOTING_DELAY, TEVA_VOTING_PERIOD, TEVA_PROPOSAL_THRESHOLD, TEVA_QUORUM_PERCENTAGE);
  await initializeTevaGovernorTx.wait();
  console.log("TevaGovernor initialization response: ", initializeTevaGovernorTx);
}