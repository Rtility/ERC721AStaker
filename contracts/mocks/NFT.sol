//SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

import "erc721a/contracts/extensions/ERC721AQueryable.sol";

contract NFT is ERC721AQueryable {
    constructor() ERC721A("NFT", "NFT") {}

    function mint(uint256 quantity) external {
        _mint(msg.sender, quantity);
    }

    function burn(uint256 tokenId) external {
        _burn(tokenId);
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    /** 
     * @dev Experimental feature
     * Some users that want to stake in long-term and harvest frequently, 
     * could consider setting their tokens data explicitly in the NFT contract, 
     * that would save a lot of gas in the futures harvest calls.
     */
    function explicitSetTokenOwnerShip(uint256 tokenId) external {
        if (_ownerships[tokenId].addr == address(0) && !_ownerships[tokenId].burned) {
            TokenOwnership memory ownership = _ownershipOf(tokenId);
            _ownerships[tokenId].addr = ownership.addr;
            _ownerships[tokenId].startTimestamp = ownership.startTimestamp;
        }
    }
}
