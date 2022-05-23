import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

// deploy contract function
async function deployContract(contractName: string, ...callData: any): Promise<any> {
  const factory = await ethers.getContractFactory(contractName);
  const contract = await factory.deploy(...callData);
  await contract.deployed();
  return contract;
}

// increase block timestamp function
async function increaseBlockTimestamp(increase: number): Promise<void> {
  await ethers.provider.send('evm_increaseTime', [increase]);
  await ethers.provider.send('evm_mine', []);
}

const lastBlockTimestamp = async (): Promise<number> => {
  return (await ethers.provider.getBlock('latest')).timestamp;
};

const bigNumberArr = (...arr: Number[]) => arr.map((num) => BigNumber.from(num));

const ZERO_ADDRESS = ethers.constants.AddressZero;

export { deployContract, increaseBlockTimestamp, lastBlockTimestamp, bigNumberArr, ZERO_ADDRESS };
