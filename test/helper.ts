import { ethers } from 'hardhat';

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

export { deployContract, increaseBlockTimestamp };
