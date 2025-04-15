// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface ILicensor {

    // --- Events ---
    event RecipientChanged(address indexed _oldRecipient, address indexed _newRecipient);
    event Payment(address indexed _token, uint256 _amount, address indexed _to);
    event SMarginSet(uint256 indexed _oldMargin, uint256 indexed _newMargin);
    event VMarginSet(uint256 indexed _oldMargin, uint256 indexed _newMargin);

    // --- Erros ---
    error MarginMoreThanMax(uint256);
    error ZeroAddress();
    error ZeroAmount();

    // --- Functions ---
    function sRoyaltyMargin() external view returns (uint256);
    function vRoyaltyMargin() external view returns (uint256);
    function MAX_ROYALTY_MARGIN() external view returns (uint256);
}