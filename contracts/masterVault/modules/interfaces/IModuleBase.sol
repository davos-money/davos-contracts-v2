// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IModuleBase {
        
    // --- Errors ---
    error NotOwnerOrDavosProvider();

    // --- Functions ---
    function asset() external view virtual returns (address);
    
    function beforeDeposit(bytes memory _data, bytes memory _context) external;
    function beforeRedeem(bytes memory _data, bytes memory _context) external;
    function beforeMint(bytes memory _data, bytes memory _context) external;
    function beforeWithdraw(bytes memory _data, bytes memory _context) external;

    function afterDeposit(bytes memory _data, bytes memory _context) external;
    function afterRedeem(bytes memory _data, bytes memory _context) external;
    function afterMint(bytes memory _data, bytes memory _context) external;
    function afterWithdraw(bytes memory _data, bytes memory _context) external;

    function previewTotalAssets(uint256 _assets) external view returns (uint256 _actualAssets);
}