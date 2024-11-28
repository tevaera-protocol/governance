# tevaera-dao
This repository contains all smart contracts related to the governance of our DAO, including voting mechanisms, proposal management, token-based decision-making, and any additional modules to support decentralized governance processes

### Slither Installation and Dependency
#### Install Solidity Compiler and Slither(https://github.com/crytic/slither) 
```
npm install -g solc
```
```
pip3 install slither-analyzer
```
check out the link for installation of slither and add solidity Compiler.
#### Use Below command to provide path of smart contract and run the slither.py (Install Python3)
```
python3 getReport.py contracts/<Input File Path> reports/<Output File Path>  
```
Ex: python3 slither.py contracts/MultiVestingWalletCliffV1.sol reports/multivestingwalletcliffV1.json

### Project Setup

1. Once you clone the repo, run in terminal
> yarn install


### Compiling the Contracts

To compile all the contracts, run in terminal: -
> npx hardhat compile

### Deploy contracts on zkSync

To deploy the separate contracts, run in terminal: -
> yarn hardhat deploy-zksync --script <scriptName> --network <network_name>

Ex: yarn hardhat deploy-zksync --script zksync/citizenidv1_deploy.ts --network zksyncSepolia
### Run Interaction Scripts Cases on zkSync
> yarn hardhat run filePath

Ex: yarn hardhat run ./scripts/tgeTevaConfiguration.ts   
### Run Test Cases on zkSync
Local Set up 
> foundryup-zksync --branch main
> forge build --zksync
> forge test --zksync
