//SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IERC721AQueryable is IERC721 {

    struct TokenOwnership {
        address addr;
        uint64 startTimestamp;
        bool burned;
    }

    function explicitOwnershipOf(uint256 tokenId) external view returns (TokenOwnership memory);

    function explicitOwnershipsOf(uint256[] memory tokenIds) external view returns (TokenOwnership[] memory);
}
