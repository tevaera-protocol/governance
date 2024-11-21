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

  const tevaContractAddress = process.env.TEVA_TOKEN_CONTRCAT;
  if (!tevaContractAddress) throw new Error("Please set tevaContractAddress address");

  const tevaIntialTokenMintAmount = BigInt(process.env.TEVA_INITIAL_TOKEN_MINT_AMOUNT);
  if (!tevaIntialTokenMintAmount) throw new Error("Please set tevaIntialTokenMintAmount address");

  const multiVestingContractAddress = process.env.MULTI_VESTING_CONTRACT_ADDRESS;
  if (!multiVestingContractAddress) throw new Error("Please set multiVestingContractAddress address");

  const tevaMerkleDistributorContractAddress = process.env.TEVA_MERKLE_DISTRIBUTOR_CONTRACT_ADDRESS;
  if (!tevaMerkleDistributorContractAddress) throw new Error("Please set tevaMerkleDistributorContractAddress address");

  const dexContractAddress = process.env.DEX_CONTRACT_ADDRESS;
  if (!dexContractAddress) throw new Error("Please set dexContractAddress address");

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

  const addMinterRoleToMultiVestingTx = await tevaContract.grantRole(tevaContract.MINTER_ROLE(), multiVestingContractAddress);
  await addMinterRoleToMultiVestingTx.wait();

  const addMinterRoleToTevaMerkleTx = await tevaContract.grantRole(tevaContract.MINTER_ROLE(), tevaMerkleDistributorContractAddress);
  await addMinterRoleToTevaMerkleTx.wait();

  const addMinterRoleToAdminWalletTx = await tevaContract.grantRole(tevaContract.MINTER_ROLE(), contractAdminWallet.getAddress());
  await addMinterRoleToAdminWalletTx.wait();

  const mintTevaTx = await tevaContract.mint(contractAdminWallet.getAddress(), tevaIntialTokenMintAmount);
  await mintTevaTx.wait();

  const approveTevaToDexTx = await tevaContract.approve(dexContractAddress, tevaIntialTokenMintAmount);
  await approveTevaToDexTx.wait();

}

run();