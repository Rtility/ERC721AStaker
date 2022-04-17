import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import type { Coin, NFT, NFTStaker } from '../typechain-types';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployContract, increaseBlockTimestamp } from './helper';

describe('Staker', () => {
  let coin: Coin;
  let nft: NFT;
  let staker: NFTStaker;
  let owner: SignerWithAddress;
  let addrs: SignerWithAddress[];
  const ownerCoinCount = ethers.utils.parseEther('1000000');
  const ownerNFTCount = BigNumber.from(10);
  const prizePerSec = ethers.utils.parseEther('0.016');

  beforeEach(async () => {
    // deploy contracts
    coin = await deployContract('Coin', ownerCoinCount);
    nft = await deployContract('NFT', ownerNFTCount);
    staker = await deployContract('NFTStaker', coin.address, nft.address, prizePerSec);

    [owner, ...addrs] = await ethers.getSigners();
  });

  describe('deply', () => {
    context('coin', () => {
      it('owner should owns tokens', async () => {
        const balance = await coin.balanceOf(owner.address);
        expect(balance).to.eq(ownerCoinCount);
      });
    });

    context('nft', () => {
      it('owner should owns tokens', async () => {
        const balance = await nft.balanceOf(owner.address);
        expect(balance).to.eq(ownerNFTCount);
      });
    });
  });

  describe('staker', () => {
    beforeEach(async () => {
      // transfer coins from owner to staker contract
      await coin.transfer(staker.address, ownerCoinCount);

      // sanity check
      expect(await coin.balanceOf(staker.address)).to.eq(ownerCoinCount);
    });

    context('stake', () => {
      it('should stake token', async () => {
        const tokenId = 3;
        await staker.stake(tokenId);
        const stakeData = await staker.stakes(3);
        expect(stakeData.lastHarvestTimestamp).not.eq(0);
        expect(stakeData.owner).to.eq(owner.address);
      });
    });

    context('harvest', () => {
      it('should harvest token', async () => {
        const tokenId = 3;
        const waitSec = 60;

        await staker.stake(tokenId);

        const balanceBefore = await coin.balanceOf(owner.address);
        // sanity check
        expect(await coin.balanceOf(owner.address)).to.eq(0);

        await increaseBlockTimestamp(waitSec);

        await staker.harvest(tokenId);

        const balanceAfter = await coin.balanceOf(owner.address);

        expect(balanceAfter.sub(balanceBefore)).to.eq(prizePerSec.mul(waitSec + 1));
      });
    });
  });
});
