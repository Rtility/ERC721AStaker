import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import type { Coin__factory, Coin } from '../typechain-types';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Coin', async () => {
  let coin: Coin;
  let owner: SignerWithAddress;
  let addrs: SignerWithAddress[];
  const ownerCount = BigNumber.from(1_000_000);

  beforeEach(async () => {
    // deploy contract
    const CoinFactory = (await ethers.getContractFactory('Coin')) as Coin__factory;
    coin = await CoinFactory.deploy(ownerCount);
    await coin.deployed();
    [owner, ...addrs] = await ethers.getSigners();
  });

  it('owner should owns tokens', async () => {
    const balance = await coin.balanceOf(owner.address);
    expect(balance).to.eq(ownerCount.mul(BigNumber.from(10).pow(18)));
  });
});
