// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IMasterVault {

    // --- Events ---
    event DavosProviderChanged(address _oldProvider, address _newProvider);
    event ModuleAdded(address _module, bytes _context);
    event ContextChanged(address _module, bytes _oldContext, bytes _newContext);

    // --- Errors ---
    error NotOwnerOrProvider();
    error InvalidAssets();
    error ZeroAddress();
    error InvalidShares();
    error ModuleCallFailed();

    // --- Functions ---
    // function underlyings() external returns (uint256);
}