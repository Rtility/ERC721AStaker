//SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

import "@rari-capital/solmate/src/tokens/ERC20.sol";

contract Coin is ERC20 {
    constructor(uint256 count) ERC20("Coin", "COIN", 18) {
        _mint(msg.sender, count * 1 ether);
    }
}
