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
    nft = await deployContract('NFT');
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
      it('owner should mints tokens', async () => {
        await nft.mint(ownerNFTCount);
        const balance = await nft.balanceOf(owner.address);
        expect(balance).to.eq(ownerNFTCount);
      });
    });
  });

  describe('staker', () => {
    const stakedTokenIds = [1, 2, 3, 4, 5];

    beforeEach(async () => {
      // transfer coins from owner to staker contract
      await coin.transfer(staker.address, ownerCoinCount);

      // mint tokens with gaps between them to check startTimestamp
      await nft.mint(1);
      await nft.mint(3);
      await nft.mint(6);
    });

    context('stake', () => {
      const stake = async (tokenIds: number[]): Promise<void> => {
        await staker.stake(tokenIds);

        // get last block time stamp
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        for (const tokenId of tokenIds) {
          // get tokenId timestamp
          const tokenIdStartTimestamp = (await nft.explicitOwnershipOf(tokenId)).startTimestamp;

          const stakeData = await staker.stakes(tokenId);

          expect(stakeData.owner).to.eq(owner.address);
          expect(stakeData.startTimestamp).to.eq(tokenIdStartTimestamp);
          expect(stakeData.lastHarvestTimestamp).to.eq(blockTimestamp);
        }
      };
      it('should stake token', async () => {
        await stake([1]);
      });

      it('should stake multiple tokens', async () => {
        await stake(stakedTokenIds);
      });
    });

    context('harvest', () => {
      let balanceBefore: BigNumber;
      const waitSec = 60;

      beforeEach(async () => {
        await staker.stake(stakedTokenIds);
        balanceBefore = await coin.balanceOf(owner.address);

        await increaseBlockTimestamp(waitSec);
      });

      const harvest = async (tokenIds: number[]): Promise<void> => {
        await staker.harvest(tokenIds);

        const balanceAfter = await coin.balanceOf(owner.address);
        expect(balanceAfter.sub(balanceBefore)).to.eq(prizePerSec.mul(waitSec + 1).mul(tokenIds.length));

        // check lastHarvestTimestamp for each tokenId
        for (const tokenId of tokenIds) {
          const stakeData = await staker.stakes(tokenId);
          expect(stakeData.lastHarvestTimestamp).to.eq((await ethers.provider.getBlock('latest')).timestamp);
        }
      };

      it('should harvest one token', async () => {
        await harvest([1]);
      });

      it('should harvest multiple tokens', async () => {
        await harvest(stakedTokenIds);
      });
    });
  });
});
