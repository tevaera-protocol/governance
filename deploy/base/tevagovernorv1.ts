import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as dotenv from "dotenv";

dotenv.config();
const TransparentUpgradeableProxy = require("../artifacts/contracts/proxy/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json");
const TevaGovernorV1 = require("../../artifacts/contracts/TevaGovernorV1.sol/TevaGovernorV1.json");

// An example of a deploy script that will deploy and call a simple contract.
async function main(hre: HardhatRuntimeEnvironment) {
  console.log(
    `Running deploy script for the upgradable TevaGovernor contract with transparent proxy...`
  );

  // environment variables
  const base_rpc_provider_uri = process.env.BASE_RPC_PROVIDER_URI;
  if (!base_rpc_provider_uri) throw new Error("Please set Base provider url");
  const provider = new ethers.JsonRpcProvider(base_rpc_provider_uri);

  const proxyAdminContractAddress = process.env.BASE_PROXY_ADMIN_CONTRACT_ADDRESS;
  if (!proxyAdminContractAddress)
    throw new Error("Please set proxyAdminContractAddress");

  const tevaVotingDelay = process.env.TEVA_VOTING_DELAY; // Number of blocks in between
  if (!tevaVotingDelay) throw new Error("Please set TEVA_VOTING_DELAY");
  const tevaTokenContract = process.env.TEVA_TOKEN_CONTRACT; // Number of blocks in between
  if (!tevaTokenContract) throw new Error("Please set TEVA_TOKEN_CONTRACT");
  const tevaTimelockContract = process.env.TEVA_TIMELOCK_CONTRACT_ADDRESS; // Number of blocks in between
  if (!tevaTimelockContract) throw new Error("Please set TEVA_TOKEN_CONTRACT");
  const tevaVotingPeriod = process.env.TEVA_VOTING_PERIOD; // Numbers of blocks in between when voting remains valid
  if (!tevaVotingPeriod) throw new Error("Please set TEVA_VOTING_PERIOD");
  let tevaProposalThresholdValue = process.env.TEVA_PROPOSAL_THRESHOLD;
  if (!tevaProposalThresholdValue)
    throw new Error("Please set TEVA_PROPOSAL_THRESHOLD");
  const tevaProposalThreshold = ethers.parseUnits(tevaProposalThresholdValue, 18); // Token value :1000
  const tevaQuorumPercentage = process.env.TEVA_QUORUM_PERCENTAGE; // quorum percentage
  if (!tevaQuorumPercentage)
    throw new Error("Please set TEVA_QUORUM_PERCENTAGE");

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

  // Deploy the Teva Governor contract
  const TevaGovernorArtifact = new ethers.ContractFactory(
    TevaGovernorV1.abi,
    TevaGovernorV1.bytecode,
    contractAdminWallet
  );
  const TevaGovernorConstArgs: any = [];
  const TevaGovernorContract = await TevaGovernorArtifact.deploy();
  await TevaGovernorContract.waitForDeployment();

  console.log(
    "args: " +
    TevaGovernorContract.interface.encodeDeploy(TevaGovernorConstArgs)
  );
  console.log(
    `TevaGovernor was deployed to ${await TevaGovernorContract.getAddress()}`
  );

  try {
    await hre.run("verify:verify", {
      address: await TevaGovernorContract.getAddress(),
      constructorArguments: TevaGovernorConstArgs,
    });
  } catch (error: any) {
    if (error.name === "ContractVerificationInvalidStatusCodeError") {
      console.warn("Verification warning: Contract already verified or partially verified.");
    } else {
      console.error("Unexpected error during verification:", error);
    }
  }

  // // Deploy the transparent proxy
  // const transparentProxyConstArgs = [
  //   await TevaGovernorContract.getAddress(),
  //   proxyAdminContractAddress,
  //   "0x",
  // ];
  // const transparentUpgradeableProxyFactory = new ethers.ContractFactory(
  //   TransparentUpgradeableProxy.abi,
  //   TransparentUpgradeableProxy.bytecode,
  //   proxyAdminWallet
  // );
  // const transparentProxyContract =
  //   await transparentUpgradeableProxyFactory.deploy(
  //     await TevaGovernorContract.getAddress(),
  //     proxyAdminContractAddress,
  //     "0x"
  //   );
  // await transparentProxyContract.waitForDeployment();
  // console.log(
  //   "transparentUpgradeableProxy deployed at:",
  //   await transparentProxyContract.getAddress()
  // );

  // try {
  //   await hre.run("verify:verify", {
  //     address: await transparentProxyContract.getAddress(),
  //     constructorArguments: transparentProxyConstArgs,
  //   });
  // } catch (error: any) {
  //   if (error.name === "ContractVerificationInvalidStatusCodeError") {
  //     console.warn("Verification warning: Contract already verified or partially verified.");
  //   } else {
  //     console.error("Unexpected error during verification:", error);
  //   }
  // }
  // // Initializing TevaGovernor contract through proxy

  // const nyContract = new ethers.Contract(
  //   await transparentProxyContract.getAddress(),
  //   TevaGovernorV1.abi,
  //   contractAdminWallet
  // );

  // const initializeTevaGovernorTx = await nyContract.initialize(
  //   tevaTokenContract,
  //   tevaTimelockContract,
  //   tevaVotingDelay,
  //   tevaVotingPeriod,
  //   tevaProposalThreshold,
  //   tevaQuorumPercentage
  // );
  // await initializeTevaGovernorTx.wait();
  // console.log(
  //   "TevaGovernor initialization response: ",
  //   initializeTevaGovernorTx
  // );
}
main(require("hardhat")).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
