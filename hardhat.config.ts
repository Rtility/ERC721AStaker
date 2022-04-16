import dotenv from 'dotenv';

import { HardhatUserConfig, task } from 'hardhat/config';

import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-gas-reporter';
import "solidity-coverage"

dotenv.config();

const privateAcc = process.env.ETH_PRIVATE_KEY !== undefined ? [process.env.ETH_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.13',
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
      },
    },
  },
  networks: {
    rinkeby: {
      url: process.env.RINKEBY_URL || '',
      accounts: privateAcc,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 120,
    showTimeSpent: true,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COIN_MARKET_CAP_API_KEY || '',
    excludeContracts: ['mocks/MinterMock.sol'],
  },
};

task('accounts', 'Prints the list of accounts', async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

export default config;
