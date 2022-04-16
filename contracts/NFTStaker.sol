//SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IERC721AQueryable.sol";

error WrongOwner();
error TokenIsBurned();
error AlreadyStaked();
error TokenIsTransferedOrBurnedBefore();

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
    uint256 public immutable pricePerSec;

    constructor(address coin_, address nft_, uint256 pricePerSec_) {
        coin = coin_;
        nft = nft_;
        pricePerSec = pricePerSec_;
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
        if (stakeData[tokenId].owner != msg.sender) revert WrongOwner();

        uint64 currentTimestamp = uint64(block.timestamp);

        stakeData[tokenId].lastHarvestTimestamp = currentTimestamp;

        IERC721AQueryable token = IERC721AQueryable(nft);
        IERC721AQueryable.TokenOwnership memory owner = token.explicitOwnershipOf(tokenId);

        if (owner.addr != msg.sender) revert WrongOwner();
        if (owner.startTimestamp != stakeData[tokenId].startTimestamp) revert TokenIsTransferedOrBurnedBefore();

        uint256 amount = uint256(currentTimestamp - stakeData[tokenId].lastHarvestTimestamp) * pricePerSec;

        IERC20(coin).safeTransfer(msg.sender, amount);
    }
}
