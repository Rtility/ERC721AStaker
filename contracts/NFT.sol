//SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

import "erc721a/contracts/extensions/ERC721AQueryable.sol";

contract NFT is ERC721AQueryable {
    constructor(uint256 quantity) ERC721A("NFT", "NFT") {
        _mint(msg.sender, quantity, "", false);
    }
}
