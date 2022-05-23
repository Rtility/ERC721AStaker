// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

error ContractMintNotAllowed();

interface INFTStaker {
    function stake(uint256[] calldata tokenIds) external;
    function harvest(uint256[] calldata tokenIds) external;
}

contract StakerMock {
    INFTStaker public staker;

    constructor(address staker_) {
        staker = INFTStaker(staker_);
    }

    function stake(uint256[] calldata tokenIds) external {
        staker.stake(tokenIds);
    }

    function harvest(uint256[] calldata tokenIds) external {
        staker.harvest(tokenIds);
    }
}
