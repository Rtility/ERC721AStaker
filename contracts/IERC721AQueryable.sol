//SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IERC721AQueryable is IERC721 {
    // Compiler will pack this into a single 256bit word.
    struct TokenOwnership {
        // The address of the owner.
        address addr;
        // Keeps track of the start time of ownership with minimal overhead for tokenomics.
        uint64 startTimestamp;
        // Whether the token has been burned.
        bool burned;
    }

    function explicitOwnershipOf(uint256 tokenId) external view returns (TokenOwnership memory);

    function explicitOwnershipsOf(uint256[] memory tokenIds) external view returns (TokenOwnership[] memory);
}
