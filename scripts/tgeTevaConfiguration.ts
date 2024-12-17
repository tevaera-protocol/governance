import { ethers } from "ethers";

const { Contract, Provider, Wallet } = require("zksync-ethers");
const dotenv = require("dotenv");

dotenv.config();

// An example of a deploy script that will deploy and call a simple contract.
async function run() {
  console.log(
    `TGE Configuration Script for grant role and intial teva token mint`
  );

  // environment variables
  const provider = new Provider(process.env.ZKSYNC_PROVIDER_URI);
  if (!provider) throw new Error("Please set zksync provider url");

  const tevaContractAddress = process.env.TEVA_TOKEN_CONTRACT;
  if (!tevaContractAddress)
    throw new Error("Please set tevaContractAddress address");

  const tevaIntialTokenMintAmount = process.env.TEVA_INITIAL_TOKEN_MINT_AMOUNT;
  if (!tevaIntialTokenMintAmount)
    throw new Error("Please set tevaIntialTokenMintAmount address");

  const multiVestingContractAddress =
    process.env.MULTI_VESTING_CONTRACT_ADDRESS;
  if (!multiVestingContractAddress)
    throw new Error("Please set multiVestingContractAddress address");

  const tevaCommunityMerkleDistributorContractAddress =
    process.env.TEVA_COMMUNITY_MERKLE_DISTRIBUTOR_CONTRACT_ADDRESS;
  if (!tevaCommunityMerkleDistributorContractAddress)
    throw new Error(
      "Please set tevaCommunityMerkleDistributorContractAddress address"
    );

  const tevaInvestorMerkleDistributorContractAddress =
    process.env.TEVA_INVESTOR_MERKLE_DISTRIBUTOR_CONTRACT_ADDRESS;
  if (!tevaInvestorMerkleDistributorContractAddress)
    throw new Error(
      "Please set tevaInvestorMerkleDistributorContractAddress address"
    );

  const dexContractAddress = process.env.DEX_CONTRACT_ADDRESS;
  if (!dexContractAddress)
    throw new Error("Please set dexContractAddress address");

  // Initialize the safeWallet.
  const contractAdminWallet = new Wallet(
    `${process.env.CONTRACT_ADMIN_WALLET_PK}`,
    provider
  );
  console.log(
    "contractAdminWallet address: ",
    await contractAdminWallet.getAddress()
  );
  // Initializing MatchRegistryV1 contract through proxy
  const TEVA_ABI =
    require("../artifacts-zk/contracts/token/TevaTokenV1.sol/TevaTokenV1.json").abi;

  const tevaContract = new Contract(
    tevaContractAddress,
    TEVA_ABI,
    contractAdminWallet._signerL2()
  );

  const addMinterRoleToMultiVestingTx = await tevaContract.grantRole(
    tevaContract.MINTER_ROLE(),
    multiVestingContractAddress
  );
  await addMinterRoleToMultiVestingTx.wait();

  const addMinterRoleToTevaCommunityMerkleTx = await tevaContract.grantRole(
    tevaContract.MINTER_ROLE(),
    tevaCommunityMerkleDistributorContractAddress
  );
  await addMinterRoleToTevaCommunityMerkleTx.wait();

  const addMinterRoleToTevaInvestorMerkleTx = await tevaContract.grantRole(
    tevaContract.MINTER_ROLE(),
    tevaInvestorMerkleDistributorContractAddress
  );
  await addMinterRoleToTevaInvestorMerkleTx.wait();

  const addMinterRoleToAdminWalletTx = await tevaContract.grantRole(
    tevaContract.MINTER_ROLE(),
    contractAdminWallet.getAddress()
  );
  await addMinterRoleToAdminWalletTx.wait();

  const mintTevaTx = await tevaContract.mint(
    contractAdminWallet.getAddress(),
    ethers.parseEther(tevaIntialTokenMintAmount)
  );
  await mintTevaTx.wait();

  const approveTevaToDexTx = await tevaContract.approve(
    dexContractAddress,
    ethers.parseEther(tevaIntialTokenMintAmount)
  );
  await approveTevaToDexTx.wait();
}

run();
