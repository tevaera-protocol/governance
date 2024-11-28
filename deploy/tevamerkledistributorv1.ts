import { Provider, Wallet } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as dotenv from "dotenv";
import { Contract } from "ethers";

dotenv.config();

export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running deploy script for the upgradeable TevaMerkleDistributor contract with transparent proxy...`
  );

  // environment variables
  const provider = new Provider(process.env.ZKSYNC_PROVIDER_URI);
  if (!provider) throw new Error("Please set zksync provider url");
  const proxyAdminContractAddress = process.env.PROXY_ADMIN_CONTRACT_ADDRESS;
  if (!proxyAdminContractAddress)
    throw new Error("Please set proxyAdminContractAddress");
  const tevaToken = process.env.TEVA_TOKEN_CONTRACT;
  if (!tevaToken) throw new Error("Please set teva token address");
  const merkelRoot = process.env.MERKEL_ROOT;
  if (!merkelRoot) throw new Error("Please set merkel root");
  const maxClaimableAmount = process.env.MAX_CLAIMABLE_LIMIT;
  if (!maxClaimableAmount) throw new Error("Pleae ste max claimable limit");
  const claimStart = process.env.CLAIM_START_TIME;
  if (!claimStart) throw new Error("Please set claim starting time");
  const claimEnd = process.env.CLAIM_END_TIME;
  if (!claimEnd) throw new Error("Please set claim end time");

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
  const proxyContractDeployer = new Deployer(hre, proxyAdminWallet);

  const contractName =
    "contracts/TevaMerkleDistributorV1.sol:TevaMerkleDistributorV1";

  const tevaMerkleDistributorArtifact = await contractDeployer.loadArtifact(
    contractName
  );

  const tevaMerkleDistributorArgs = [];

  const tevaMerkleDistributorContract = await contractDeployer.deploy(
    tevaMerkleDistributorArtifact,
    tevaMerkleDistributorArgs
  );

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
  const verifyTevaMerkleDistributor = await hre.run("verify:verify", {
    address: await tevaMerkleDistributorContract.getAddress(),
    contract: contractName,
    constructorArguments: tevaMerkleDistributorContract.interface.encodeDeploy(
      tevaMerkleDistributorArgs
    ),
  });

  console.log("Verification res: ", verifyTevaMerkleDistributor);

  // Deploy the transparent proxy
  const transparentProxyConstArgs = [
    await tevaMerkleDistributorContract.getAddress(),
    proxyAdminContractAddress,
    "0x",
  ];

  const transparentUpgradeableProxyArtifact =
    await proxyContractDeployer.loadArtifact(
      "contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy"
    );

  const transparentProxyContract = await proxyContractDeployer.deploy(
    transparentUpgradeableProxyArtifact,
    transparentProxyConstArgs
  );

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

  const nyContract = new Contract(
    await transparentProxyContract.getAddress(),
    tevaMerkleDistributorArtifact.abi,
    contractAdminWallet._signerL2()
  );

  const initializeTevaTokenTx = await nyContract.initialize(
    tevaToken,
    merkelRoot,
    maxClaimableAmount,
    claimStart,
    claimEnd
  );
  await initializeTevaTokenTx.wait();
  console.log(
    "TevaMerkleDistributor initialization response: ",
    initializeTevaTokenTx
  );
}