import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import type { Coin, NFT, NFTStaker } from '../typechain-types';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployContract } from './helper';

describe('Staker', () => {
  let coin: Coin;
  let nft: NFT;
  let staker: NFTStaker;
  let owner: SignerWithAddress;
  let addrs: SignerWithAddress[];
  const ownerCoinCount = BigNumber.from(1_000_000);
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
        expect(balance).to.eq(ownerCoinCount.mul(BigNumber.from(10).pow(18)));
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
    context('stake', () => {
      it('should stake token', async () => {
        const tokenId = 3;
        await staker.stake(tokenId);
        const stakeData = await staker.stakeData(3);
        expect(stakeData.lastHarvestTimestamp).not.eq(0);
        expect(stakeData.owner).to.eq(owner.address);
      });
    });

    context('harvest', () => {
      it('should harvest token', async () => {
        const tokenId = 3;
        await staker.stake(tokenId);

        const balanceBefore = await coin.balanceOf(owner.address);
        const prize = await staker.getPrize(tokenId);

        await staker.harvest(tokenId);

        const balanceAfter = await coin.balanceOf(owner.address);

        expect(balanceAfter.sub(balanceBefore)).to.eq(prize);
      });
    });
  });
});
