// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IYieldModule {

    // --- Events ---
    event YieldMarginSet(uint256 indexed _oldMargin, uint256 indexed _newMargin);
    event YieldRoyaltySet(uint256 indexed _oldMargin, uint256 indexed _newMargin);
    event YieldClaimed(uint256 indexed _vaultYield, uint256 indexed _royaltyYield, address indexed _royalty);
    event PriceControllerChanged(address indexed _oldController, address indexed _newController);
    
    // --- Errors ---
    error MoreThanMax();

    // --- Functions ---
    function priceController() external view returns (address);
}