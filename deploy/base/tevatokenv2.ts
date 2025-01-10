import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as dotenv from "dotenv";

dotenv.config();
const TransparentUpgradeableProxy = require("../../artifacts/contracts/proxy/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json");
const TevaTokenV2 = require("../../artifacts/contracts/token/TevaTokenV2.sol/TevaTokenV2.json");
// An example of a deploy script that will deploy and call a simple contract.
async function main(hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running deploy script for the upgradable TevaToken contract with transparent proxy...`
  );

  // environment variables
  const base_rpc_provider_uri = process.env.BASE_RPC_PROVIDER_URI;
  if (!base_rpc_provider_uri) throw new Error("Please set Base provider url");
  const provider = new ethers.JsonRpcProvider(base_rpc_provider_uri);

  const proxyAdminContractAddress = process.env.BASE_PROXY_ADMIN_CONTRACT_ADDRESS;
  if (!proxyAdminContractAddress)
    throw new Error("Please set proxyAdminContractAddress");

  const layerzeroBaseEndpoint = process.env.LAYERZERO_BASE_ENDPOINT_V2;
  if (!layerzeroBaseEndpoint)
    throw new Error("Please set base layer zero endpoint");

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

  // Deploy the teva token contract
  const TevaTokenArtifact = new ethers.ContractFactory(
    TevaTokenV2.abi,
    TevaTokenV2.bytecode,
    contractAdminWallet
  );
  const TevaTokenConstArgs: any = [layerzeroBaseEndpoint];
  const TevaTokenContract = await TevaTokenArtifact.deploy(layerzeroBaseEndpoint);
  await TevaTokenContract.waitForDeployment();

  console.log(
    "args: " + TevaTokenContract.interface.encodeDeploy(TevaTokenConstArgs)
  );
  console.log(
    `TevaToken was deployed to ${await TevaTokenContract.getAddress()}`
  );

  try {
    await hre.run("verify:verify", {
      address: await TevaTokenContract.getAddress(),
      constructorArguments: TevaTokenConstArgs,
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
    await TevaTokenContract.getAddress(),
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
      await TevaTokenContract.getAddress(),
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


  // Initializing TevaToken contract through proxy

  const nyContract = new ethers.Contract(
    await transparentProxyContract.getAddress(),
    TevaTokenV2.abi,
    contractAdminWallet
  );
  const oAppOwner = await contractAdminWallet.getAddress();
  const initializeTevaTokenTx = await nyContract.initialize(oAppOwner);
  await initializeTevaTokenTx.wait();
  console.log("TevaToken initialization response: ", initializeTevaTokenTx);
}

main(require("hardhat")).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});