// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IPluginBase {

    // --- Events ---

    // --- Errors ---

    // --- Functions ---
    function beforeHook() external returns (uint256);
    function afterHook() external returns (uint256);
}