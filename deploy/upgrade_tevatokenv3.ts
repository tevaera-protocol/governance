import { Contract, Provider, Wallet } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as dotenv from "dotenv";
const ethers = require("ethers");

dotenv.config();

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running deploy script for the upgradable TevaToken V3 contract with transparent proxy...`
  );

  // environment variables
  const provider = new Provider(process.env.ZKSYNC_PROVIDER_URI);
  if (!provider) throw new Error("Please set zksync provider url");
  const proxyAdminContractAddress = process.env.PROXY_ADMIN_CONTRACT_ADDRESS;
  if (!proxyAdminContractAddress)
    throw new Error("Please set proxyAdminContractAddress");
  const tevaTokenContractAddress = process.env.TEVA_TOKEN_CONTRACT;
  if (!tevaTokenContractAddress)
    throw new Error("Please set tevaTokenContractAddress");

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
  const tevaTokenArtifact = await contractDeployer.loadArtifact(
    "contracts/TevaTokenV3.sol:TevaTokenV3"
  );
  const tevaTokenConstArgs = [];
  const tevaTokenContract = await contractDeployer.deploy(
    tevaTokenArtifact,
    tevaTokenConstArgs
  );
  console.log(
    "args: " + tevaTokenContract.interface.encodeDeploy(tevaTokenConstArgs)
  );
  console.log(
    `TevaToken was deployed to ${await tevaTokenContract.getAddress()}`
  );

  const verifyTevaToken = await hre.run("verify:verify", {
    address: await tevaTokenContract.getAddress(),
    constructorArguments: tevaTokenConstArgs,
  });

  console.log("Verification res: ", verifyTevaToken);

  // Initializing proxy admin contract
  const PA_JSON = require("../artifacts-zk/contracts/proxy/ProxyAdmin.sol/ProxyAdmin.json");
  const PA_ABI = PA_JSON.abi;

  const paContract = new Contract(
    proxyAdminContractAddress,
    PA_ABI,
    proxyAdminWallet._signerL2()
  );

  const upgradeImplementation = await paContract.upgrade(
    tevaTokenContractAddress,
    await tevaTokenContract.getAddress()
  );
  await upgradeImplementation.wait();
  console.log("Proxy upgrade response: ", upgradeImplementation);

  const nyContract = new Contract(
    tevaTokenContractAddress,
    tevaTokenArtifact.abi,
    contractAdminWallet._signerL2()
  );

  const initialize = await nyContract.initializeV3();
  await initialize.wait();
  console.log("Initialized successfully");

  const pause = await nyContract.initializeV3();
  await pause.wait();
  console.log("Paused successfully");
}
