import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as dotenv from "dotenv";

dotenv.config();
const ProxyAdmin = require("../../artifacts/contracts/proxy/ProxyAdmin.sol/ProxyAdmin.json");



async function main(hre: HardhatRuntimeEnvironment) {
     // environment variables
     const base_rpc_provider_uri = process.env.BASE_RPC_PROVIDER_URI;
     if (!base_rpc_provider_uri) throw new Error("Please set Base provider url");
     const provider = new ethers.JsonRpcProvider(base_rpc_provider_uri);
 
     const layerzeroBaseEndpoint = process.env.LAYERZERO_BASE_ENDPOINT_V2;
     if (!layerzeroBaseEndpoint)
         throw new Error("Please set base layer zero endpoint");
     const teveTimelockDelay = process.env.TEVA_TIMELOCK_EXECUTION_DELAY;
     if (!teveTimelockDelay) throw new Error("Please set TEVA_TIMELOCK_EXECUTION_DELAY address");
     const minDelay = BigInt(teveTimelockDelay);
 
     let proposalAddressArray = process.env.PROPOSERS_ADDRESS_ARRAY;
     if (!proposalAddressArray) throw new Error("Please set PROPOSERS_ADDRESS_ARRAY ");
     proposalAddressArray = JSON.parse(proposalAddressArray);
 
     let executorAddressArray = process.env.EXECUTORS_ADDRESS_ARRAY;
     if (!executorAddressArray) throw new Error("Pleae set EXECUTORS_ADDRESS_ARRAY");
     executorAddressArray = JSON.parse(executorAddressArray);
 
     const tevaVotingDelay = process.env.TEVA_VOTING_DELAY; // Number of blocks in between
     if (!tevaVotingDelay) throw new Error("Please set TEVA_VOTING_DELAY");
     const tevaVotingPeriod = process.env.TEVA_VOTING_PERIOD; // Numbers of blocks in between when voting remains valid
     if (!tevaVotingPeriod) throw new Error("Please set TEVA_VOTING_PERIOD");
     let tevaProposalThresholdValue = process.env.TEVA_PROPOSAL_THRESHOLD;
     if (!tevaProposalThresholdValue)
         throw new Error("Please set TEVA_PROPOSAL_THRESHOLD");
     const tevaProposalThreshold = ethers.parseUnits(tevaProposalThresholdValue, 18); // Token value :1000
     const tevaQuorumPercentage = process.env.TEVA_QUORUM_PERCENTAGE; // quorum percentage
     if (!tevaQuorumPercentage)
         throw new Error("Please set TEVA_QUORUM_PERCENTAGE");
 
     const merkelRoot = process.env.INVESTOR_MERKEL_ROOT;
     if (!merkelRoot) throw new Error("Please set merkel root");
     const maxClaimableAmount = process.env.INVESTOR_MAX_CLAIMABLE_LIMIT;
     if (!maxClaimableAmount) throw new Error("Pleae ste max claimable limit");
     const claimStart = process.env.CLAIM_START_TIME;
     if (!claimStart) throw new Error("Please set claim starting time");
     const claimEnd = process.env.CLAIM_END_TIME;
     if (!claimEnd) throw new Error("Please set claim end time");
 
     // Initialize the safeWallet.
     const proxyAdminWallet = new ethers.Wallet(
         `${process.env.PROXY_ADMIN_WALLET_PK}`,
         provider
     );
     console.log("proxyAdminWallet address: ", await proxyAdminWallet.getAddress());
 
     const contractAdminWallet = new ethers.Wallet(
         `${process.env.CONTRACT_ADMIN_WALLET_PK}`,
         provider
     );
     console.log("contractAdminWallet address: ", await contractAdminWallet.getAddress());

     // deploy proxy admin
    const proxyAdminConstArgs: any = [await proxyAdminWallet.getAddress()];

    console.log("Deploying the proxyAdmin...");
    const proxyAdminFactory = new ethers.ContractFactory(
        ProxyAdmin.abi,
        ProxyAdmin.bytecode,
        proxyAdminWallet
    );
    const proxyAdmin = await proxyAdminFactory.deploy(await proxyAdminWallet.getAddress());
    await proxyAdmin.waitForDeployment();
    console.log("proxyAdmin deployed at:", await proxyAdmin.getAddress());
    try {
        const verifyProxy = await hre.run("verify:verify", {
            address: await proxyAdmin.getAddress(),
            constructorArguments: proxyAdminConstArgs,
        });
        console.log("Verification result: ", verifyProxy);
    } catch (error: any) {
        if (error.name === "ContractVerificationInvalidStatusCodeError") {
            console.warn("Verification warning: Contract already verified or partially verified.");
        } else {
            console.error("Unexpected error during verification:", error);
        }
    }
}

main(require("hardhat")).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});