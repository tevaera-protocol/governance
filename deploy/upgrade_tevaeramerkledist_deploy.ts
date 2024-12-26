import * as dotenv from "dotenv";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Contract, Provider, Wallet } from "zksync-ethers";
import { ethers } from "ethers";

dotenv.config();

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running upgrade script for the TevaMerkleDistributorV2 contract with transparent proxy...`
  );

  // environment variables
  const provider = new Provider(process.env.ZKSYNC_PROVIDER_URI);
  if (!provider) throw new Error("Please set zksync provider url");
  const proxyAdminContractAddress = process.env.PROXY_ADMIN_CONTRACT_ADDRESS;
  if (!proxyAdminContractAddress)
    throw new Error("Please set proxyAdminContractAddress");
  const tevaToken = process.env.TEVA_TOKEN_CONTRACT;
  if (!tevaToken) throw new Error("Please set teva token address");
  const merkelRoot = process.env.COMMUNITY_MERKEL_ROOT;
  if (!merkelRoot) throw new Error("Please set merkel root");
  const maxClaimableAmount = process.env.COMMUNITY_MAX_CLAIMABLE_LIMIT;
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

  // // Initialize deployers
  const contractDeployer = new Deployer(hre, contractAdminWallet);

  // Deploy the new version of citizen id contract
  const tevaMerkleDistributorArtifact = await contractDeployer.loadArtifact(
    "contracts/TevaMerkleDistributorV2.sol:TevaMerkleDistributorV2"
  );
  const tevaMerkleDistributorConstArgs = [];
  const tevaMerkleDistributorContract = await contractDeployer.deploy(
    tevaMerkleDistributorArtifact,
    tevaMerkleDistributorConstArgs
  );
  console.log(
    "args: " +
      tevaMerkleDistributorContract.interface.encodeDeploy(
        tevaMerkleDistributorConstArgs
      )
  );
  console.log(
    `${
      tevaMerkleDistributorArtifact.contractName
    } was deployed to ${await tevaMerkleDistributorContract.getAddress()}`
  );

  const res = await hre.run("verify:verify", {
    address: await tevaMerkleDistributorContract.getAddress(),
    constructorArguments: tevaMerkleDistributorConstArgs,
  });

  console.log("Verification res: ", res);

  // Initializing proxy admin contract
  const PA_JSON = require("../artifacts-zk/contracts/proxy/ProxyAdmin.sol/ProxyAdmin.json");
  const PA_ABI = PA_JSON.abi;

  const paContract = new Contract(
    proxyAdminContractAddress,
    PA_ABI,
    proxyAdminWallet._signerL2()
  );

  const upgradeImplementation = await paContract.upgrade(
    process.env.TEVA_COMMUNITY_MERKLE_DISTRIBUTOR_CONTRACT_ADDRESS,
    await tevaMerkleDistributorContract.getAddress()
  );
  await upgradeImplementation.wait();
  console.log("Proxy upgrade response: ", upgradeImplementation);

  const nyContract = new Contract(
    process.env.TEVA_COMMUNITY_MERKLE_DISTRIBUTOR_CONTRACT_ADDRESS,
    tevaMerkleDistributorArtifact.abi,
    contractAdminWallet._signerL2()
  );

  const initializeTevaTokenTx = await nyContract.initializeV2(
    merkelRoot,
    ethers.parseEther(maxClaimableAmount),
    claimStart,
    claimEnd
  );
  await initializeTevaTokenTx.wait();
}
