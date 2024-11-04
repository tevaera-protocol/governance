import { Contract, ContractFactory, Provider, Wallet } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as dotenv from "dotenv";

dotenv.config();
const TransparentUpgradeableProxy = require("../artifacts-zk/contracts/proxy/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json");

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running deploy script for the upgradable MultiVestingWalletCliff contract with transparent proxy...`
  );

  // environment variables
  const provider = new Provider(process.env.ZKSYNC_PROVIDER_URI);
  if (!provider) throw new Error("Please set zksync provider url");
  const proxyAdminContractAddress = process.env.PROXY_ADMIN_CONTRACT_ADDRESS;
  if (!proxyAdminContractAddress)
    throw new Error("Please set proxyAdminContractAddress");
  const tevaTokenContract = process.env.TEVA_TOKEN_CONTRACT_ADDRESS;
  if (!tevaTokenContract) throw new Error("Please set tevaTokenContract");

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
  const MultiVestingWalletCliffArtifact = await contractDeployer.loadArtifact(
    "contracts/MultiVestingWalletCliffV1.sol:MultiVestingWalletCliffV1"
  );
  const MultiVestingWalletCliffConstArgs = [];
  const MultiVestingWalletCliffContract = await contractDeployer.deploy(
    MultiVestingWalletCliffArtifact,
    MultiVestingWalletCliffConstArgs
  );
  console.log(
    "args: " +
      MultiVestingWalletCliffContract.interface.encodeDeploy(
        MultiVestingWalletCliffConstArgs
      )
  );
  console.log(
    `MultiVestingWalletCliff was deployed to ${await MultiVestingWalletCliffContract.getAddress()}`
  );

  const verifyMultiVestingWalletCliff = await hre.run("verify:verify", {
    address: await MultiVestingWalletCliffContract.getAddress(),
    constructorArguments: MultiVestingWalletCliffConstArgs,
  });

  console.log("Verification res: ", verifyMultiVestingWalletCliff);

  // Deploy the transparent proxy
  const transparentProxyConstArgs = [
    await MultiVestingWalletCliffContract.getAddress(),
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
      await MultiVestingWalletCliffContract.getAddress(),
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

  // Initializing MultiVestingWalletCliff contract through proxy
  const NY_JSON = require("../artifacts-zk/contracts/MultiVestingWalletCliffV1.sol/MultiVestingWalletCliffV1.json");
  const NY_ABI = NY_JSON.abi;

  const nyContract = new Contract(
    await transparentProxyContract.getAddress(),
    NY_ABI,
    contractAdminWallet._signerL2()
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
