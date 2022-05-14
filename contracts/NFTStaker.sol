//SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "erc721a/contracts/interfaces/IERC721AQueryable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTStaker is Ownable {
    using SafeERC20 for IERC20;

    error WrongOwner(uint256 tokenId);
    error TokenIsBurned(uint256 tokenId);
    error AlreadyStaked(uint256 tokenId);
    error TokenIsMoved(uint256 tokenId);
    error NotEnoughFundsInTheContract();
    error WithdrawFailed();
    error ContractsNotAllowed();

    struct StakedToken {
        address owner;
        uint48 startTimestamp;
        uint48 lastHarvestTimestamp;
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

    /// no contract
    modifier noContract() {
        if (tx.origin != msg.sender) revert ContractsNotAllowed();
        _;
    }

    function stake(uint256[] calldata tokenIds) external noContract {
        IERC721AQueryable nftContract = IERC721AQueryable(nft);
        uint256 tokenIdsLength = tokenIds.length;

        unchecked {
            for (uint256 i; i != tokenIdsLength; ++i) {
                uint256 tokenId = tokenIds[i];

                IERC721AQueryable.TokenOwnership memory currentOwnership = nftContract.explicitOwnershipOf(tokenId);

                if (currentOwnership.addr != msg.sender) revert WrongOwner(tokenId);
                if (currentOwnership.burned) revert TokenIsBurned(tokenId);

                // revert if already staked
                if (stakes[tokenId].startTimestamp == currentOwnership.startTimestamp) revert AlreadyStaked(tokenId);

                stakes[tokenId].owner = msg.sender;
                stakes[tokenId].startTimestamp = uint48(currentOwnership.startTimestamp);
                stakes[tokenId].lastHarvestTimestamp = uint48(block.timestamp);
            }
        }
    }

    function harvest(uint256[] calldata tokenIds) external noContract {
        uint256 stop = tokenIds.length;
        uint256 amount;
        IERC721AQueryable nftContract = IERC721AQueryable(nft);

        unchecked {
            for (uint256 i; i != stop; ++i) {
                uint256 tokenId = tokenIds[i];

                StakedToken memory stakedToken = stakes[tokenId];

                if (stakedToken.owner != msg.sender) revert WrongOwner(tokenId);

                uint48 currentTimestamp = uint48(block.timestamp);

                stakes[tokenId].lastHarvestTimestamp = currentTimestamp;

                uint48 currentOwnershipTimestamp = uint48(nftContract.explicitOwnershipOf(tokenId).startTimestamp);

                if (currentOwnershipTimestamp != stakedToken.startTimestamp) revert TokenIsMoved(tokenId);

                amount += uint256(currentTimestamp - stakedToken.lastHarvestTimestamp) * prizePerSec;
            }
        }

        // check contract balance
        uint256 balance = IERC20(coin).balanceOf(address(this));
        if (balance < amount) revert NotEnoughFundsInTheContract();

        IERC20(coin).safeTransfer(msg.sender, amount);
    }

    function getPrize(uint256 tokenId) external view returns (uint256) {
        uint64 currentTimestamp = uint64(block.timestamp);

        uint256 amount = uint256(currentTimestamp - stakes[tokenId].lastHarvestTimestamp) * prizePerSec;

        return amount;
    }

    /// Withdraw ERC20
    function withdrawERC20(IERC20 token_, uint256 amount) external onlyOwner {
        token_.safeTransfer(msg.sender, amount);
    }
}
