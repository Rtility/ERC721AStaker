//SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IERC721AQueryable.sol";
import "hardhat/console.sol";

error WrongOwner(uint256 tokenId);
error TokenIsBurned(uint256 tokenId);
error AlreadyStaked(uint256 tokenId);
error TokenIsMoved(uint256 tokenId);

contract NFTStaker {
    using SafeERC20 for IERC20;

    struct StakedToken {
        address owner;
        uint64 startTimestamp;
        uint64 lastHarvestTimestamp;
    }

    mapping(uint256 => StakedToken) public stakes;

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

    function stake(uint256[] calldata tokenIds) external {
        IERC721AQueryable nftContract = IERC721AQueryable(nft);
        uint256 tokenIdsLength = tokenIds.length;

        for (uint256 i; i != tokenIdsLength; ) {
            uint256 tokenId = tokenIds[i];

            IERC721AQueryable.TokenOwnership memory currentOwnership = nftContract.explicitOwnershipOf(tokenId);

            if (currentOwnership.addr != msg.sender) revert WrongOwner(tokenId);
            if (currentOwnership.burned) revert TokenIsBurned(tokenId);

            // revert if already staked
            // TODO: check if the first `if` is needed
            if (stakes[tokenId].owner == msg.sender) {
                if (stakes[tokenId].startTimestamp == currentOwnership.startTimestamp) revert AlreadyStaked(tokenId);
            }

            stakes[tokenId].owner = msg.sender;
            stakes[tokenId].startTimestamp = currentOwnership.startTimestamp;
            stakes[tokenId].lastHarvestTimestamp = uint64(block.timestamp);

            unchecked {
                ++i;
            }
        }
    }

    function harvest(uint256[] calldata tokenIds) external {
        uint256 stop = tokenIds.length;
        uint256 amount;
        IERC721AQueryable nftContract = IERC721AQueryable(nft);

        for (uint256 i; i != stop; ) {
            uint256 tokenId = tokenIds[i];

            StakedToken memory stakedToken = stakes[tokenId];

            if (stakedToken.owner != msg.sender) revert WrongOwner(tokenId);

            uint64 currentTimestamp = uint64(block.timestamp);
            stakes[tokenId].lastHarvestTimestamp = currentTimestamp;

            uint64 currentOwnershipTimestamp = nftContract.explicitOwnershipOf(tokenId).startTimestamp;

            if (currentOwnershipTimestamp != stakedToken.startTimestamp) revert TokenIsMoved(tokenId);

            unchecked {
                amount += uint256(currentTimestamp - stakedToken.lastHarvestTimestamp) * prizePerSec;
                ++i;
            }
        }

        IERC20(coin).safeTransfer(msg.sender, amount);
    }

    function getPrize(uint256 tokenId) external view returns (uint256) {
        uint64 currentTimestamp = uint64(block.timestamp);

        uint256 amount = uint256(currentTimestamp - stakes[tokenId].lastHarvestTimestamp) * prizePerSec;

        return amount;
    }
}
