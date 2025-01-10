const ethers = require("ethers");
const dotenv = require("dotenv");

dotenv.config();

const TT_JSON = require("../../artifacts/contracts/token/TevaTokenV1.sol/TevaTokenV1.json");
const TT_ABI = TT_JSON.abi;

const mintTeva = async () => {
  console.log(`Minting tokens...`);

  const receiver = "<wallet_address>";
  const amount = 140_000_000;
  const amountWei = ethers.parseEther(amount.toString());

  const base_rpc_provider_uri = process.env.BASE_RPC_PROVIDER_URI;
  if (!base_rpc_provider_uri) throw new Error("Please set Base provider url");
  const provider = new ethers.JsonRpcProvider(base_rpc_provider_uri);

  const tevaToken = process.env.TEVA_TOKEN_CONTRACT;
  if (!tevaToken) throw new Error("Please set TEVA_TOKEN_CONTRACT");

  const wallet = new ethers.Wallet(
    `${process.env.CONTRACT_ADMIN_WALLET_PK}`,
    provider
  );
  console.log("Caller Wallet: ", await wallet.getAddress());

  const tevaContract = new ethers.Contract(tevaToken, TT_ABI, wallet);

  // Assign minter role
  const txn = await tevaContract.mint(receiver, amountWei);

  await txn.wait();
  console.log(
    `${Number(
      amount
    )} tokens got minted to ${receiver} for contract ${tevaToken}, TX: ${
      txn.hash
    }`
  );
};

mintTeva();
