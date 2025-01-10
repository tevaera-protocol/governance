import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as dotenv from "dotenv";

dotenv.config();
const TransparentUpgradeableProxy = require("../artifacts/contracts/proxy/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json");
const MultiVestingWalletCliffV1 = require("../../artifacts/contracts/MultiVestingWalletCliffV1.sol/MultiVestingWalletCliffV1.json");
// An example of a deploy script that will deploy and call a simple contract.
async function main(hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running deploy script for the upgradable MultiVestingWalletCliff contract with transparent proxy...`
  );

  // environment variables
  const base_rpc_provider_uri = process.env.BASE_RPC_PROVIDER_URI;
  if (!base_rpc_provider_uri) throw new Error("Please set Base provider url");
  const provider = new ethers.JsonRpcProvider(base_rpc_provider_uri);

  const proxyAdminContractAddress = process.env.BASE_PROXY_ADMIN_CONTRACT_ADDRESS;
  if (!proxyAdminContractAddress)
    throw new Error("Please set base proxyAdminContractAddress");
  const tevaTokenContract = process.env.TEVA_TOKEN_CONTRACT;
  if (!tevaTokenContract) throw new Error("Please set tevaTokenContract");

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

  // Deploy the Multi Vesting V1 contract
  const MultiVestingWalletCliffArtifact = new ethers.ContractFactory(MultiVestingWalletCliffV1.abi, MultiVestingWalletCliffV1.bytecode, contractAdminWallet);
  const MultiVestingWalletCliffConstArgs: any = [];
  const MultiVestingWalletCliffContract = await MultiVestingWalletCliffArtifact.deploy();
  await MultiVestingWalletCliffContract.waitForDeployment();

  console.log(
    "args: " +
    MultiVestingWalletCliffContract.interface.encodeDeploy(
      MultiVestingWalletCliffConstArgs
    )
  );
  console.log(
    `MultiVestingWalletCliff was deployed to ${await MultiVestingWalletCliffContract.getAddress()}`
  );

  try {
    await hre.run("verify:verify", {
      address: await MultiVestingWalletCliffContract.getAddress(),
      constructorArguments: MultiVestingWalletCliffConstArgs,
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
    await MultiVestingWalletCliffContract.getAddress(),
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
      await MultiVestingWalletCliffContract.getAddress(),
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


  // Initializing MultiVestingWalletCliff contract through proxy

  const nyContract = new ethers.Contract(
    await transparentProxyContract.getAddress(),
    MultiVestingWalletCliffV1.abi,
    contractAdminWallet
  );

  const initializeMultingVestingWalletTx = await nyContract.initialize(
    tevaTokenContract
  );
  await initializeMultingVestingWalletTx.wait();
  console.log(
    "MultiVestingWalletCliff initialization response: ",
    initializeMultingVestingWalletTx
  );
}
main(require("hardhat")).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});