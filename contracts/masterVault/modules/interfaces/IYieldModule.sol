// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IYieldModule {

    // --- Events ---
    event YieldMarginSet(uint256 _oldMargin, uint256 _newMargin);
    event YieldRoyaltySet(uint256 _oldMargin, uint256 _newMargin);
    event YieldClaimed(uint256 _vaultYield, uint256 _royaltyYield, address _royalty);
    event RatioAdapterChanged(address _oldAdapter, address _newAdapter);
    event PluginChanged(address _oldPlugin, address _newPlugin);
    
    // --- Errors ---
    error MoreThanMax();
    error ZeroAddress();
}