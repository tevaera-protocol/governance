import { Contract, Provider, Wallet } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as dotenv from "dotenv";
const ethers = require("ethers");

dotenv.config();

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running deploy script for the upgradable TevaGovernor V2 contract with transparent proxy...`
  );

  // environment variables
  const provider = new Provider(process.env.ZKSYNC_PROVIDER_URI);
  if (!provider) throw new Error("Please set zksync provider url");
  const proxyAdminContractAddress = process.env.PROXY_ADMIN_CONTRACT_ADDRESS;
  if (!proxyAdminContractAddress)
    throw new Error("Please set proxyAdminContractAddress");
  const governorContractAddress = process.env.TEVA_GOVERNOR_CONTRACT_ADDRESS;
  if (!governorContractAddress)
    throw new Error("Please set governorContractAddress");
  const tevaVotingDelay = process.env.TEVA_VOTING_DELAY; // Number of blocks in between
  if (!tevaVotingDelay) throw new Error("Please set TEVA_VOTING_DELAY");
  const tevaVotingPeriod = process.env.TEVA_VOTING_PERIOD; // Numbers of blocks in between when voting remains valid
  if (!tevaVotingPeriod) throw new Error("Please set TEVA_VOTING_PERIOD");
  let tevaProposalThreshold = process.env.TEVA_PROPOSAL_THRESHOLD;
  if (!tevaProposalThreshold)
    throw new Error("Please set TEVA_PROPOSAL_THRESHOLD");
  tevaProposalThreshold = ethers.parseUnits(tevaProposalThreshold, 18); // Token value :1000
  const tevaQuorumPercentage = process.env.TEVA_QUORUM_PERCENTAGE; // quorum percentage
  if (!tevaQuorumPercentage)
    throw new Error("Please set TEVA_QUORUM_PERCENTAGE");

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
    "contracts/TevaGovernorV2.sol:TevaGovernorV2"
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
    `TevaGovernor was deployed to ${await tevaGovernorContract.getAddress()}`
  );

  const verifyTevaGovernor = await hre.run("verify:verify", {
    address: await tevaGovernorContract.getAddress(),
    constructorArguments: tevaGovernorConstArgs,
  });

  console.log("Verification res: ", verifyTevaGovernor);

  // Initializing proxy admin contract
  const PA_JSON = require("../artifacts-zk/contracts/proxy/ProxyAdmin.sol/ProxyAdmin.json");
  const PA_ABI = PA_JSON.abi;

  const paContract = new Contract(
    proxyAdminContractAddress,
    PA_ABI,
    proxyAdminWallet._signerL2()
  );

  const upgradeImplementation = await paContract.upgrade(
    governorContractAddress,
    await tevaGovernorContract.getAddress()
  );
  await upgradeImplementation.wait();
  console.log("Proxy upgrade response: ", upgradeImplementation);

  const nyContract = new Contract(
    governorContractAddress,
    tevaGovernorArtifact.abi,
    contractAdminWallet._signerL2()
  );

  const initializeTevaTokenTx = await nyContract.initializeV2(
    tevaVotingDelay,
    tevaVotingPeriod,
    tevaProposalThreshold,
    tevaQuorumPercentage
  );
  await initializeTevaTokenTx.wait();
}
