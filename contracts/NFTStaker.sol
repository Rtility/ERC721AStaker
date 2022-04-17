//SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IERC721AQueryable.sol";
import "hardhat/console.sol";

error WrongOwner();
error TokenIsBurned();
error AlreadyStaked();
error TokenIsMoved();

contract NFTStaker {
    using SafeERC20 for IERC20;

    struct StakesInfo {
        address owner;
        uint64 startTimestamp;
        uint64 lastHarvestTimestamp;
    }

    mapping(uint256 => StakesInfo) public stakeData;

    address public immutable coin;
    address public immutable nft;
    uint256 public immutable prizePerSec;

    constructor(
        address coin_,
        address nft_,
        uint256 prizePerSec_
    ) {
        coin = coin_;
        nft = nft_;
        prizePerSec = prizePerSec_;
    }

    function stake(uint256 tokenId) external {
        IERC721AQueryable token = IERC721AQueryable(nft);

        IERC721AQueryable.TokenOwnership memory owner = token.explicitOwnershipOf(tokenId);

        if (owner.addr != msg.sender) revert WrongOwner();
        if (owner.burned) revert TokenIsBurned();

        // revert if already staked
        if (stakeData[tokenId].owner == msg.sender) {
            if (stakeData[tokenId].startTimestamp == owner.startTimestamp) revert AlreadyStaked();
        }

        stakeData[tokenId].owner = msg.sender;
        stakeData[tokenId].startTimestamp = owner.startTimestamp;
        stakeData[tokenId].lastHarvestTimestamp = uint64(block.timestamp);
    }

    function harvest(uint256 tokenId) external {
        StakesInfo memory stakedToken = stakeData[tokenId];

        if (stakedToken.owner != msg.sender) revert WrongOwner();

        uint64 currentTimestamp = uint64(block.timestamp);


        IERC721AQueryable nftContract = IERC721AQueryable(nft);
        uint64 currentOwnershipTimestamp = nftContract.explicitOwnershipOf(tokenId).startTimestamp;

        if (currentOwnershipTimestamp != stakedToken.startTimestamp) revert TokenIsMoved();

        uint256 amount;
        unchecked {
            amount = uint256(currentTimestamp - stakedToken.lastHarvestTimestamp) * prizePerSec;
        }

        IERC20(coin).safeTransfer(msg.sender, amount);

        stakeData[tokenId].lastHarvestTimestamp = currentTimestamp;
    }

    function getPrize(uint256 tokenId) external view returns (uint256) {
        uint64 currentTimestamp = uint64(block.timestamp);

        uint256 amount = uint256(currentTimestamp - stakeData[tokenId].lastHarvestTimestamp) * prizePerSec;

        return amount;
    }
}
