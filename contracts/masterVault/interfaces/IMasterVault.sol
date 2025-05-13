// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IMasterVault {

    // --- Events ---
    event ProviderChanged(address indexed _oldProvider, address indexed _newProvider);
    event ModuleAdded(address indexed _module, bytes _context);
    event ContextChanged(address indexed _module, bytes _oldContext, bytes _newContext);

    // --- Errors ---
    error NotOwnerOrProvider();
    error InvalidAssets();
    error ZeroAddress();
    error InvalidShares();
    error ModuleCallFailed();

    // --- Functions ---
    // function underlyings() external returns (uint256);
}