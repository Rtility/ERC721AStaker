import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import type { Coin, NFT, NFTStaker, StakerMock } from '../typechain-types';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployContract, increaseBlockTimestamp, lastBlockTimestamp, bigNumberArr, ZERO_ADDRESS } from './helper';

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

    addrs = await ethers.getSigners();
    owner = addrs[0];
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
    beforeEach(async () => {
      // transfer coins from owner to staker contract
      await coin.transfer(staker.address, ownerCoinCount);
    });

    describe('contract calls', async () => {
      let stakerMock: StakerMock;
      beforeEach(async () => {
        stakerMock = await deployContract('StakerMock', staker.address);
      });
      it('should revert for stake', async () => {
        await expect(stakerMock.stake([1, 2, 3, 4, 5])).to.be.revertedWith('ContractsNotAllowed');
      });

      it('should revert for harvest', async () => {
        await expect(stakerMock.harvest([1, 2, 3, 4, 5])).to.be.revertedWith('ContractsNotAllowed');
      });
    });

    const mintAndStake = async (forAddress: SignerWithAddress, quantity: BigNumber): Promise<BigNumber[]> => {
      await nft.connect(forAddress).mint(quantity);
      const mintedTokenIds = await nft.tokensOfOwner(forAddress.address);
      await staker.connect(forAddress).stake(mintedTokenIds);
      return mintedTokenIds;
    };

    context('with minted tokens', async () => {
      const stakedTokenIds = bigNumberArr(1, 2, 3, 4, 5);
      const notStakedTokenIds = bigNumberArr(6, 7, 8, 9, 10);
      const notMintedTokenIds = bigNumberArr(11, 12, 13, 14, 15);

      beforeEach(async () => {
        // mint tokens with gaps between them to check startTimestamp
        await nft.mint(1);
        await nft.mint(3);
        await nft.mint(6);
      });

      context('stake', () => {
        const stake = async (tokenIds: BigNumber[]): Promise<void> => {
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
        it('should stake one token', async () => {
          await stake([stakedTokenIds[0]]);
        });

        it('should stake multiple tokens', async () => {
          await stake(stakedTokenIds);
        });

        it('should revert when already staked', async () => {
          await staker.stake(stakedTokenIds);
          await expect(staker.stake([stakedTokenIds[0]])).to.be.revertedWith('AlreadyStaked(1)');
          await expect(staker.stake(stakedTokenIds)).to.be.revertedWith('AlreadyStaked(1)');
          await expect(
            staker.stake([notStakedTokenIds[0], notStakedTokenIds[1], stakedTokenIds[0]])
          ).to.be.revertedWith('AlreadyStaked(1)');
        });

        it('should not revert if previously staked but not staked now', async () => {
          const testTokenId = 1;

          await staker.stake([testTokenId]);

          await nft.transferFrom(owner.address, addrs[5].address, testTokenId);
          // sanity check
          expect(await nft.ownerOf(testTokenId)).to.eq(addrs[5].address);

          await nft.connect(addrs[5]).transferFrom(addrs[5].address, owner.address, testTokenId);

          await stake([stakedTokenIds[0]]);
        });

        it('should revert if not owner of the token', async () => {
          await expect(staker.connect(addrs[5]).stake([1])).to.be.revertedWith('WrongOwner(1)');

          // mint some token for adrs 5
          await nft.connect(addrs[5]).mint(5);
          // sanity check
          expect(await nft.ownerOf(11)).to.be.eq(addrs[5].address);

          await expect(staker.connect(addrs[5]).stake([1, 11, 12, 13, 14])).to.be.revertedWith('WrongOwner(1)');
          await expect(staker.connect(addrs[5]).stake([11, 1, 12, 13, 14])).to.be.revertedWith('WrongOwner(1)');
        });

        it('should revert if token is burned', async () => {
          const tokenId = 1;
          // burn
          await nft.burn(tokenId);
          await expect(staker.stake([tokenId])).to.be.revertedWith('TokenIsBurned(1)');
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

        const harvest = async (tokenIds: BigNumber[]): Promise<void> => {
          // get lastHarvestTimestamp for each token
          let lastHarvestTimestamps: any = {};
          for (const tokenId of tokenIds) {
            const stakeData = await staker.stakes(tokenId);
            lastHarvestTimestamps[tokenId.toNumber()] = stakeData.lastHarvestTimestamp;
          }

          await staker.harvest(tokenIds);
          const blockTimestamp = await lastBlockTimestamp();

          const balanceAfter = await coin.balanceOf(owner.address);

          // calculate prize
          let prize = BigNumber.from(0);
          for (const tokenId of tokenIds) {
            const tokenIdLastHarvestTimestamp = lastHarvestTimestamps[tokenId.toNumber()];
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
          await harvest([stakedTokenIds[0]]);
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
          await expect(staker.harvest([6])).to.be.revertedWith('WrongOwner(6)');
          await expect(staker.harvest([6, 7, 8, 9, 10])).to.be.revertedWith('WrongOwner(6)');
          await expect(staker.harvest([1, 2, 3, 6])).to.be.revertedWith('WrongOwner(6)');
          await expect(staker.harvest([6, 1, 2, 3])).to.be.revertedWith('WrongOwner(6)');
        });

        it('should fail if token is burned', async () => {
          const tokenId = stakedTokenIds[0];
          await nft.burn(tokenId);

          const revertMsg = `TokenIsMoved(${tokenId.toString()})`;

          await expect(staker.harvest([tokenId])).to.be.revertedWith(revertMsg);
          await expect(staker.harvest([tokenId, 2, 3, 4, 5])).to.be.revertedWith(revertMsg);
          await expect(staker.harvest([2, tokenId, 3, 4, 5])).to.be.revertedWith(revertMsg);
        });

        it('should fail if token is transfered out', async () => {
          const tokenId = stakedTokenIds[0];
          await nft.transferFrom(owner.address, addrs[5].address, tokenId);

          const revertMsg = `TokenIsMoved(${tokenId.toString()})`;

          await expect(staker.harvest([tokenId])).to.be.revertedWith(revertMsg);
          await expect(staker.harvest([tokenId, 2, 3, 4, 5])).to.be.revertedWith(revertMsg);
          await expect(staker.harvest([2, tokenId, 3, 4, 5])).to.be.revertedWith(revertMsg);
        });

        it('should fail if token is transfered out and back', async () => {
          const tokenId = stakedTokenIds[0];
          await nft.transferFrom(owner.address, addrs[5].address, tokenId);
          // sanity check
          expect(await nft.ownerOf(tokenId)).to.eq(addrs[5].address);

          await nft.connect(addrs[5]).transferFrom(addrs[5].address, owner.address, tokenId);
          // sanity check
          expect(await nft.ownerOf(tokenId)).to.eq(owner.address);

          const revertMsg = `TokenIsMoved(${tokenId.toString()})`;

          await expect(staker.harvest([tokenId])).to.be.revertedWith(revertMsg);
          await expect(staker.harvest([tokenId, 2, 3, 4, 5])).to.be.revertedWith(revertMsg);
          await expect(staker.harvest([2, tokenId, 3, 4, 5])).to.be.revertedWith(revertMsg);
        });
      });

      describe('staked info getters', async () => {
        beforeEach(async () => {
          // stake with gaps
          await staker.stake([1]);
          await staker.stake([3, 4]);
          await staker.stake([2, 5]);
        });
        context('stakedTokensOfOwner', async () => {
          it('should return correct value', async () => {
            const res = await staker.stakedTokensOfOwner(owner.address, 0, 100);
            expect(res).to.be.eql(stakedTokenIds);
          });

          it('should return correct value if transfered', async () => {
            const expected = bigNumberArr(1, 2, 3, 5);
            await nft.transferFrom(owner.address, addrs[5].address, 4);
            const res = await staker.stakedTokensOfOwner(owner.address, 0, 100);
            expect(res).to.be.eql(expected);
          });

          it('should return empty array for not staker address', async () => {
            const res = await staker.stakedTokensOfOwner(addrs[5].address, 0, 100);
            expect(res).to.be.eql([]);
          });

          it('should revert if stop >= start', async () => {
            await expect(staker.stakedTokensOfOwner(owner.address, 0, 0)).to.be.revertedWith('InvalidQueryRange');
            await expect(staker.stakedTokensOfOwner(owner.address, 10, 10)).to.be.revertedWith('InvalidQueryRange');
            await expect(staker.stakedTokensOfOwner(owner.address, 20, 10)).to.be.revertedWith('InvalidQueryRange');
            await expect(staker.stakedTokensOfOwner(owner.address, 10, 0)).to.be.revertedWith('InvalidQueryRange');
            await expect(staker.stakedTokensOfOwner(owner.address, 10, 9)).to.be.revertedWith('InvalidQueryRange');
          });
        });

        context('isStillStaked', async () => {
          it('should return true for staked token id', async () => {
            for (const tokenId of stakedTokenIds) {
              expect(await staker.isStillStaked(tokenId)).to.be.true;
            }
          });

          it('should return false for not staked token id', async () => {
            for (const tokenId of notStakedTokenIds) {
              expect(await staker.isStillStaked(tokenId)).to.be.false;
            }
          });

          it('should return false for not minted token id', async () => {
            for (const tokenId of notMintedTokenIds) {
              expect(await staker.isStillStaked(tokenId)).to.be.false;
            }
          });

          it('should return false if token is transfered', async () => {
            const tokenId = stakedTokenIds[0];
            // sanity check
            expect(await staker.isStillStaked(tokenId)).to.be.true;

            await nft.transferFrom(owner.address, addrs[5].address, tokenId);
            expect(await staker.isStillStaked(tokenId)).to.be.false;
          });

          it('should return false if token is burned', async () => {
            const tokenId = stakedTokenIds[0];
            // sanity check
            expect(await staker.isStillStaked(tokenId)).to.be.true;

            await nft.burn(tokenId);
            expect(await staker.isStillStaked(tokenId)).to.be.false;
          });
        });

        context('isStillStakedForOwner', async () => {
          it('should return false for zero address', async () => {
            expect(await staker.isStillStakedForOwner(ZERO_ADDRESS, 1)).to.be.false;
          });

          it('should return true for staked token id', async () => {
            for (const tokenId of stakedTokenIds) {
              expect(await staker.isStillStakedForOwner(owner.address, tokenId)).to.be.true;
            }
          });

          it('should return false for not staked token id', async () => {
            for (const tokenId of notStakedTokenIds) {
              expect(await staker.isStillStakedForOwner(owner.address, tokenId)).to.be.false;
            }
          });

          it('should return false for not minted token id', async () => {
            for (const tokenId of notMintedTokenIds) {
              expect(await staker.isStillStakedForOwner(owner.address, tokenId)).to.be.false;
            }
          });

          it('should return false if token is transfered', async () => {
            const tokenId = stakedTokenIds[0];
            // sanity check
            expect(await staker.isStillStakedForOwner(owner.address, tokenId)).to.be.true;

            await nft.transferFrom(owner.address, addrs[5].address, tokenId);
            expect(await staker.isStillStakedForOwner(owner.address, tokenId)).to.be.false;
          });

          it('should return false if token is transfered out and back', async () => {
            const tokenId = stakedTokenIds[0];
            // sanity check
            expect(await staker.isStillStakedForOwner(owner.address, tokenId)).to.be.true;

            await nft.transferFrom(owner.address, addrs[5].address, tokenId);
            // sanity check
            expect(await nft.ownerOf(tokenId)).to.be.eql(addrs[5].address);

            await nft.connect(addrs[5]).transferFrom(addrs[5].address, owner.address, tokenId);
            // sanity check
            expect(await nft.ownerOf(tokenId)).to.be.eql(owner.address);

            expect(await staker.isStillStakedForOwner(owner.address, tokenId)).to.be.false;
          });

          it('should return false if token is burned', async () => {
            const tokenId = stakedTokenIds[0];
            // sanity check
            expect(await staker.isStillStakedForOwner(owner.address, tokenId)).to.be.true;

            await nft.burn(tokenId);
            expect(await staker.isStillStakedForOwner(owner.address, tokenId)).to.be.false;
          });

          it('should return false for not owner', async () => {
            for (const i of [0, 1, 2, 3, 4]) {
              expect(await staker.isStillStakedForOwner(addrs[5].address, stakedTokenIds[i])).to.be.false;
              expect(await staker.isStillStakedForOwner(addrs[5].address, notStakedTokenIds[i])).to.be.false;
              expect(await staker.isStillStakedForOwner(addrs[5].address, notMintedTokenIds[i])).to.be.false;
            }
          });
        });

        context('areStaked', async () => {
          it('should return correct values with all staked tokens', async () => {
            // expected an array of booleans
            expect(await staker.areStaked(owner.address, stakedTokenIds)).to.be.eql(stakedTokenIds.map(() => true));
          });

          it('should return correct values with not staked tokens', async () => {
            expect(await staker.areStaked(owner.address, notStakedTokenIds)).to.be.eql(
              notStakedTokenIds.map(() => false)
            );
          });

          it('should return correct values with not minted tokens', async () => {
            expect(await staker.areStaked(owner.address, notMintedTokenIds)).to.be.eql(
              notMintedTokenIds.map(() => false)
            );
          });

          it('should return false for zero address', async () => {
            expect(await staker.areStaked(ZERO_ADDRESS, stakedTokenIds)).to.be.eql(stakedTokenIds.map(() => false));
          });

          it('should return false for wrong owner', async () => {
            expect(await staker.areStaked(addrs[5].address, stakedTokenIds)).to.be.eql(stakedTokenIds.map(() => false));
          });

          it('should return false if token is transfered', async () => {
            const tokenId = stakedTokenIds[0];
            // sanity check
            expect(await staker.areStaked(owner.address, [tokenId])).to.be.eql([true]);

            await nft.transferFrom(owner.address, addrs[5].address, tokenId);
            expect(await staker.areStaked(owner.address, [tokenId])).to.be.eql([false]);
            expect(
              await staker.areStaked(owner.address, [tokenId, notStakedTokenIds[0], notMintedTokenIds[0]])
            ).to.be.eql([false, false, false]);
            expect(await staker.areStaked(owner.address, [stakedTokenIds[1], tokenId, stakedTokenIds[2]])).to.be.eql([
              true,
              false,
              true,
            ]);
          });

          it('should return correct value with combination tokens', async () => {
            expect(
              await staker.areStaked(owner.address, [
                notStakedTokenIds[0],
                stakedTokenIds[0],
                notMintedTokenIds[0],
                stakedTokenIds[1],
              ])
            ).to.be.eql([false, true, false, true]);
          });
        });

        describe('multiple stakers', async () => {
          const stakedByAddr0 = stakedTokenIds;
          let stakedByAddr5: BigNumber[];

          beforeEach(async () => {
            stakedByAddr5 = await mintAndStake(addrs[5], BigNumber.from(5));
          });

          context('areStaked', () => {
            it('should return correct values', async () => {
              //sanity check
              expect(await staker.areStaked(addrs[5].address, stakedByAddr5)).to.be.eql(stakedByAddr5.map(() => true));
              expect(await staker.areStaked(addrs[0].address, stakedByAddr5)).to.be.eql(stakedByAddr5.map(() => false));

              expect(await staker.areStaked(addrs[5].address, stakedByAddr0)).to.be.eql(
                stakedTokenIds.map(() => false)
              );

              expect(await staker.areStaked(addrs[5].address, [stakedByAddr5[0], stakedByAddr0[0]])).to.be.eql([
                true,
                false,
              ]);
              expect(
                await staker.areStaked(addrs[5].address, [stakedByAddr0[0], stakedByAddr5[0], stakedByAddr0[1]])
              ).to.be.eql([false, true, false]);
            });
          });
        });
      });
    });

    describe('without minted tokens', async () => {
      context('stake', async () => {
        it('should revert with WrongOwner', async () => {
          await expect(staker.stake([1])).to.be.revertedWith('WrongOwner');
        });
      });

      context('harvest', async () => {
        it('should revert with WrongOwner', async () => {
          await expect(staker.harvest([1])).to.be.revertedWith('WrongOwner');
        });
      });

      context('isStillStaked', async () => {
        context('without staked or minted tokens', async () => {
          it('should return false', async () => {
            expect(await staker.isStillStaked(1)).to.be.false;
          });
        });
      });

      context('areStaked', async () => {
        it('should return all false', async () => {
          // expected an array of booleans
          expect(await staker.areStaked(owner.address, [1])).to.be.eql([false]);
          expect(await staker.areStaked(owner.address, [1, 2, 3, 4, 5])).to.be.eql([false, false, false, false, false]);
          expect(await staker.areStaked(ZERO_ADDRESS, [1])).to.be.eql([false]);
          expect(await staker.areStaked(ZERO_ADDRESS, [1, 2, 3, 4, 5])).to.be.eql([false, false, false, false, false]);
        });
      });

      context('isStillStakedForOwner', async () => {
        it('should return false for zero address', async () => {
          expect(await staker.isStillStakedForOwner(ZERO_ADDRESS, 1)).to.be.false;
        });

        it('should return false for token id', async () => {
          expect(await staker.isStillStakedForOwner(owner.address, 1)).to.be.false;
        });
      });
    });
  });
});
