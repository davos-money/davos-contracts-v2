// SPDX-License-Identifier: AGPL-3.0-or-later

// Copyright (C) 2021-2022 Dai Foundation
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

pragma solidity >=0.8.0;

interface IERC1271 {
    function isValidSignature(bytes32, bytes memory) external view returns (bytes4);
}
interface VatLike {
    function hope(address) external;
}
interface PotLike {
    function chi() external view returns (uint256);
    function rho() external view returns (uint256);
    function dsr() external view returns (uint256);
    function drip() external returns (uint256);
    function join(uint256) external;
    function exit(uint256) external;
}
interface DUSDJoinLike {
    function vat() external view returns (address);
    function davos() external view returns (address);
    function join(address, uint256) external;
    function exit(address, uint256) external;
}
interface DUSDLike {
    function transferFrom(address, address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}
interface ISDavos {

    // --- Events ---
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    event Referral(uint16 indexed referral, address indexed owner, uint256 assets, uint256 shares);

    // --- Functions ---
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function allowance(address, address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function version() external view returns (string memory);
    function decimals() external view returns (uint8);
    function deploymentChainId() external view returns (uint256);
    function PERMIT_TYPEHASH() external view returns (bytes32);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function nonces(address) external view returns (uint256);
    function vat() external view returns (VatLike);
    function DUSDJoin() external view returns (DUSDJoinLike);
    function DUSD() external view returns (DUSDLike);
    function pot() external view returns (PotLike);
    function increaseAllowance(address, uint256) external returns (bool);
    function decreaseAllowance(address, uint256) external returns (bool);
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function convertToShares(uint256) external view returns (uint256);
    function convertToAssets(uint256) external view returns (uint256);
    function maxDeposit(address) external view returns (uint256);
    function previewDeposit(uint256) external view returns (uint256);
    function deposit(uint256, address) external returns (uint256);
    function deposit(uint256, address, uint16) external returns (uint256);
    function maxMint(address) external view returns (uint256);
    function previewMint(uint256) external view returns (uint256);
    function mint(uint256, address) external returns (uint256);
    function mint(uint256, address, uint16) external returns (uint256);
    function maxWithdraw(address) external view returns (uint256);
    function previewWithdraw(uint256) external view returns (uint256);
    function withdraw(uint256, address, address) external returns (uint256);
    function maxRedeem(address) external view returns (uint256);
    function previewRedeem(uint256) external view returns (uint256);
    function redeem(uint256, address, address) external returns (uint256);
    function permit(address, address, uint256, uint256, bytes memory) external;
    function permit(address, address, uint256, uint256, uint8, bytes32, bytes32) external;
}