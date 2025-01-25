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