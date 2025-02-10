import { Contract, Provider, Wallet } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as dotenv from "dotenv";
const ethers = require("ethers");

dotenv.config();

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running deploy script for the upgradable TevaToken V2 contract with transparent proxy...`
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
  const tevaGovernorArtifact = await contractDeployer.loadArtifact(
    "contracts/TevaTokenV1.sol:TevaTokenV1"
  );
  const tevaGovernorConstArgs = [];
  const tevaGovernorContract = await contractDeployer.deploy(
    tevaGovernorArtifact,
    tevaGovernorConstArgs
  );
  console.log(
    "args: " +
      tevaGovernorContract.interface.encodeDeploy(tevaGovernorConstArgs)
  );
  console.log(
    `TevaToken was deployed to ${await tevaGovernorContract.getAddress()}`
  );

  const verifyTevaToken = await hre.run("verify:verify", {
    address: await tevaGovernorContract.getAddress(),
    constructorArguments: tevaGovernorConstArgs,
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
    await tevaGovernorContract.getAddress()
  );
  await upgradeImplementation.wait();
  console.log("Proxy upgrade response: ", upgradeImplementation);
}
