const ethers = require("ethers");
const { Wallet, Provider, Contract } = require("zksync-ethers");
const dotenv = require("dotenv");

dotenv.config();

const TT_JSON = require("../artifacts-zk/contracts/token/TevaTokenV1.sol/TevaTokenV1.json");
const TT_ABI = TT_JSON.abi;

const mintTeva = async () => {
  console.log(`Minting tokens...`);

  const receiver = "0xF9BdCbFEcB97ADE979BbCbD0bBdba5a83139a0bf";
  const amount = 140_000_000;
  const amountWei = ethers.parseEther(amount.toString());

  const providerUrl = process.env.ZKSYNC_PROVIDER_URI;
  if (!providerUrl) throw new Error("Please set ZKSYNC_PROVIDER_URI");
  const tevaToken = process.env.TEVA_TOKEN_CONTRACT;
  if (!tevaToken) throw new Error("Please set TEVA_TOKEN_CONTRACT");

  const provider = new Provider(providerUrl);
  const wallet = new Wallet(
    `${process.env.CONTRACT_ADMIN_WALLET_PK}`,
    provider
  );
  console.log("Caller Wallet: ", await wallet.getAddress());

  const tevaContract = new Contract(tevaToken, TT_ABI, wallet._signerL2());

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
