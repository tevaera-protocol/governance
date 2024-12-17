import { Contract, ContractFactory, Provider, Wallet } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as dotenv from "dotenv";

dotenv.config();
const TransparentUpgradeableProxy = require("../artifacts-zk/contracts/proxy/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json");

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running deploy script for the upgradable TevaToken contract with transparent proxy...`
  );

  // environment variables
  const provider = new Provider(process.env.ZKSYNC_PROVIDER_URI);
  if (!provider) throw new Error("Please set zksync provider url");
  let proxyAdminContractAddress = process.env.PROXY_ADMIN_CONTRACT_ADDRESS;

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
  const proxyDeployer = new Deployer(hre, proxyAdminWallet);
  const contractDeployer = new Deployer(hre, contractAdminWallet);

  if (!proxyAdminContractAddress) {
    // Deploy the proxy admin
    const proxyAdminArtifact = await proxyDeployer.loadArtifact(
      "contracts/proxy/ProxyAdmin.sol:ProxyAdmin"
    );
    const proxyAdminConstArgs = [await proxyAdminWallet.getAddress()];
    const proxyAdminContract = await proxyDeployer.deploy(
      proxyAdminArtifact,
      proxyAdminConstArgs
    );
    console.log(
      `ProxyAdmin was deployed to ${await proxyAdminContract.getAddress()}`
    );

    const proxyVerifyRes = await hre.run("verify:verify", {
      address: await proxyAdminContract.getAddress(),
      constructorArguments: proxyAdminConstArgs,
    });
    proxyAdminContractAddress = await proxyAdminContract.getAddress();

    console.log("Verification res: ", proxyVerifyRes);
  }

  // Deploy the teva token contract
  const TevaTokenArtifact = await contractDeployer.loadArtifact(
    "contracts/token/TevaTokenV1.sol:TevaTokenV1"
  );
  const TevaTokenConstArgs = [];
  const TevaTokenContract = await contractDeployer.deploy(
    TevaTokenArtifact,
    TevaTokenConstArgs
  );
  console.log(
    "args: " + TevaTokenContract.interface.encodeDeploy(TevaTokenConstArgs)
  );
  console.log(
    `TevaToken was deployed to ${await TevaTokenContract.getAddress()}`
  );

  const verifyTevaToken = await hre.run("verify:verify", {
    address: await TevaTokenContract.getAddress(),
    constructorArguments: TevaTokenConstArgs,
  });

  console.log("Verification res: ", verifyTevaToken);

  // Deploy the transparent proxy
  const transparentProxyConstArgs = [
    await TevaTokenContract.getAddress(),
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
      await TevaTokenContract.getAddress(),
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

  // Initializing TevaToken contract through proxy
  const NY_JSON = require("../artifacts-zk/contracts/token/TevaTokenV1.sol/TevaTokenV1.json");
  const NY_ABI = NY_JSON.abi;

  const nyContract = new Contract(
    await transparentProxyContract.getAddress(),
    NY_ABI,
    contractAdminWallet._signerL2()
  );

  const initializeTevaTokenTx = await nyContract.initialize();
  await initializeTevaTokenTx.wait();
  console.log("TevaToken initialization response: ", initializeTevaTokenTx);
}
