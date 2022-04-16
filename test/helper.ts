import { ethers } from 'hardhat';

// deploy contract function
async function deployContract(contractName: string, ...callData: any): Promise<any> {
  const factory = await ethers.getContractFactory(contractName);
  const contract = await factory.deploy(...callData);
  await contract.deployed();
  return contract;
}

export { deployContract };
