// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IPluginBase {

    // --- Events ---

    // --- Errors ---

    // --- Functions ---
    function beforeClaim() external returns (uint256);
    function afterClaim() external returns (uint256);
}