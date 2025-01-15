import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

require('dotenv').config();

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.26',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable the intermediate representation compiler
    },
  },
  sourcify: {
    enabled: true
  },  
  networks: {
    // for mainnet
    'base-mainnet': {
      url: 'https://mainnet.base.org'
    },
    // for testnet
    'base-sepolia': {
      url: 'https://sepolia.base.org'
    },
    // for local dev environment
    'base-local': {
      url: 'http://localhost:8545'
    },
  },
  etherscan: {
    apiKey: {
     "base-sepolia": process.env.BASE_SCAN_VERIFICATION_KEY as string,
     "base-mainnet": process.env.BASE_SCAN_VERIFICATION_KEY as string
    },
    customChains: [
      {
        network: "base-sepolia",
        chainId: 84532,
        urls: {
         apiURL: "https://api-sepolia.basescan.org/api",
         browserURL: "https://sepolia.basescan.org"
        }
      },
      {
			  network: "base-mainnet",
			  chainId: 8453,
			  urls: {
			   apiURL: "https://api.basescan.org/api",
			   browserURL: "https://basescan.org"
			  }
			}
    ]
  },
  defaultNetwork: 'hardhat',
};

export default config;