const ethers = require("ethers");

const dotenv = require("dotenv");

dotenv.config();

// An example of a deploy script that will deploy and call a simple contract.
async function run() {
  console.log(
    `TGE Configuration Script for grant role and intial teva token mint`
  );

  // environment variables
  const base_rpc_provider_uri = process.env.BASE_RPC_PROVIDER_URI;
  if (!base_rpc_provider_uri) throw new Error("Please set Base provider url");
  const provider = new ethers.JsonRpcProvider(base_rpc_provider_uri);

  const tevaContractAddress = process.env.TEVA_TOKEN_CONTRACT;
  if (!tevaContractAddress)
    throw new Error("Please set tevaContractAddress address");

  const tevaIntialTokenMintAmount = process.env.TEVA_INITIAL_TOKEN_MINT_AMOUNT;
  if (!tevaIntialTokenMintAmount)
    throw new Error("Please set tevaIntialTokenMintAmount address");

  const dexContractAddress = process.env.DEX_CONTRACT_ADDRESS;
  if (!dexContractAddress)
    throw new Error("Please set dexContractAddress address");

  // Initialize the safeWallet.
  const contractAdminWallet = new ethers.Wallet(
    `${process.env.CONTRACT_ADMIN_WALLET_PK}`,
    provider
  );
  console.log(
    "contractAdminWallet address: ",
    await contractAdminWallet.getAddress()
  );
  // Initializing MatchRegistryV1 contract through proxy
  const TEVA_ABI =
    require("../../artifacts/contracts/token/TevaTokenV1.sol/TevaTokenV1.json").abi;

  const tevaContract = new ethers.Contract(
    tevaContractAddress,
    TEVA_ABI,
    contractAdminWallet
  );

  const addMinterRoleToAdminWalletTx = await tevaContract.grantRole(
    tevaContract.MINTER_ROLE(),
    contractAdminWallet.getAddress()
  );
  await addMinterRoleToAdminWalletTx.wait();

  const approveTevaToDexTx = await tevaContract.approve(
    dexContractAddress,
    ethers.parseEther(tevaIntialTokenMintAmount)
  );
  await approveTevaToDexTx.wait();
}

run();
