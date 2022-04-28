import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import type { Coin, NFT, NFTStaker } from '../typechain-types';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployContract, increaseBlockTimestamp, lastBlockTimestamp } from './helper';

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
    const notStakedTokenIds = [6, 7, 8, 9, 10];

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
        const blockTimestamp = await lastBlockTimestamp();

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

      it('should revert when already staked', async () => {
        await staker.stake(stakedTokenIds);
        await expect(staker.stake([1])).to.be.revertedWith('AlreadyStaked(1)');
        await expect(staker.stake(stakedTokenIds)).to.be.revertedWith('AlreadyStaked(1)');
        await expect(staker.stake([6, 7, 1])).to.be.revertedWith('AlreadyStaked(1)');
      });

      it('should not revert if previously staked but not staked now', async () => {
        await staker.stake(stakedTokenIds);

        const testTokenId = 1;

        await nft.transferFrom(owner.address, addrs[5].address, testTokenId);
        // sanity check
        expect(await nft.ownerOf(testTokenId)).to.eq(addrs[5].address);
        await nft.connect(addrs[5]).transferFrom(addrs[5].address, owner.address, testTokenId);

        await stake([1]);
      });
    });

    context('harvest', () => {
      let balanceBefore: BigNumber;
      const waitSec = 60;
      let stakeTimeStamp: number;

      beforeEach(async () => {
        // stake with gaps
        await staker.stake([1]);
        await increaseBlockTimestamp(10);
        await staker.stake([3, 4]);
        await increaseBlockTimestamp(1000);
        await staker.stake([2, 5]);

        balanceBefore = await coin.balanceOf(owner.address);

        // get last block time stamp
        stakeTimeStamp = await lastBlockTimestamp();

        await increaseBlockTimestamp(waitSec);

        // sanity check
        expect(await lastBlockTimestamp()).to.be.eq(stakeTimeStamp + waitSec);
      });

      const harvest = async (tokenIds: number[]): Promise<void> => {
        // get lastHarvestTimestamp for each token
        let lastHarvestTimestamps: any = {};
        for (const tokenId of tokenIds) {
          const stakeData = await staker.stakes(tokenId);
          lastHarvestTimestamps[tokenId] = stakeData.lastHarvestTimestamp.toNumber();
        }

        await staker.harvest(tokenIds);
        const blockTimestamp = await lastBlockTimestamp();

        const balanceAfter = await coin.balanceOf(owner.address);

        // calculate prize
        let prize = BigNumber.from(0);
        for (const tokenId of tokenIds) {
          const tokenIdLastHarvestTimestamp = lastHarvestTimestamps[tokenId];
          prize = prize.add(prizePerSec.mul(blockTimestamp - tokenIdLastHarvestTimestamp));
        }

        expect(balanceAfter.sub(balanceBefore)).to.eq(prize);

        // check lastHarvestTimestamp for each tokenId
        for (const tokenId of tokenIds) {
          const stakeData = await staker.stakes(tokenId);
          expect(stakeData.lastHarvestTimestamp).to.eq(blockTimestamp);
        }
      };

      it('should harvest one token', async () => {
        await harvest([1]);
      });

      it('should harvest multiple tokens', async () => {
        await harvest(stakedTokenIds);
      });

      it('should fail if funds are not enough', async () => {
        // withdraw all funds
        await staker.withdrawERC20(coin.address, ownerCoinCount);
        await expect(staker.harvest(stakedTokenIds)).to.be.revertedWith('NotEnoughFundsInTheContract');
      });

      it('should fail if token is not staked', async () => {
        await expect(staker.harvest([notStakedTokenIds[0]])).to.be.revertedWith('WrongOwner(6)');
        await expect(staker.harvest(notStakedTokenIds)).to.be.revertedWith('WrongOwner(6)');
        await expect(staker.harvest([1, 2, 3, 6])).to.be.revertedWith('WrongOwner(6)');
        await expect(staker.harvest([6, 1, 2, 3])).to.be.revertedWith('WrongOwner(6)');
      });
    });
  });
});
