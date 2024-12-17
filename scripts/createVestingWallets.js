const ethers = require("ethers");
const { Wallet, Provider, Contract } = require("zksync-ethers");
const dotenv = require("dotenv");

dotenv.config();

const MVW_JSON = require("../artifacts-zk/contracts/MultiVestingWalletCliffV1.sol/MultiVestingWalletCliffV1.json");
const MVW_ABI = MVW_JSON.abi;

// List of vesting schedules
const VESTING_WALLET_SCHEDULES = [];

// Note : Before Running the script, please make sure to add total amount of funds to MULTI_VESTING_CLIFF_CONTRACT_ADDRESS
// so that MULTI_VESTING_CLIFF_CONTRACT_ADDRESS have enough tokens to create the vesting.
const createVestingWallets = async () => {
  console.log(`Creating vesting wallets...`);

  const providerUrl = process.env.ZKSYNC_PROVIDER_URI;
  if (!providerUrl) throw new Error("Please set ZKSYNC_PROVIDER_URI");
  const multiVestingContractAddress = process.env.MULTI_VESTING_WALLET_CONTRACT;
  if (!providerUrl) throw new Error("Please set MULTI_VESTING_WALLET_CONTRACT");

  const provider = new Provider(providerUrl);
  const wallet = new Wallet(
    `${process.env.CONTRACT_ADMIN_WALLET_PK}`,
    provider
  );
  console.log("wallet: ", await wallet.getAddress());

  const mvwContract = new Contract(
    multiVestingContractAddress,
    MVW_ABI,
    wallet._signerL2()
  );

  for (const schedule of VESTING_WALLET_SCHEDULES) {
    const startUnix = Math.floor(
      new Date(schedule.vestingStartTimeISO).getTime() / 1000
    ); // Convert ISO to UNIX timestamp
    const duration = schedule.vestingDurationDays * 24 * 60 * 60; // Convert days to seconds
    const cliff = Math.floor(
      new Date(schedule.cliffEndTimeISO).getTime() / 1000
    ); // Convert ISO to UNIX timestamp

    console.log(`Creating vesting wallet for ${schedule.beneficiary}...`);

    // Call createVestingWallet function
    const createVestingTx = await mvwContract.createVestingWallet(
      schedule.beneficiary,
      startUnix,
      duration,
      cliff,
      schedule.amount
    );

    await createVestingTx.wait();
    console.log(
      `Vesting wallet created for ${schedule.beneficiary}, TX: ${createVestingTx.hash}`
    );
  }
};

createVestingWallets();
