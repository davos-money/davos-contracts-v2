// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

interface IProvider {

    // --- Events ---
    event Deposit(address indexed _account, uint256 _amount);
    event Withdrawal(address indexed _owner, address indexed _recipient, uint256 _amount);
    event CollateralChanged(address _collateral);
    event CollateralDerivativeChanged(address _collateralDerivative);
    event MasterVaultChanged(address _masterVault);
    event InteractionChanged(address _interaction);
    event UnderlyingChanged(address _underlying);
    event NativeStatusChanged(bool _isNative);
    event ATokenChanged(address _wAToken);
    event Referral(bytes32 indexed _code);

    // --- Functions ---
    function provide(uint256 _amount) external payable returns (uint256 value);
    function release(address _recipient, uint256 _amount) external returns (uint256 realAmount);
    function liquidation(address _recipient, uint256 _amount) external;
    function daoBurn(address _account, uint256 _value) external;
    function daoMint(address _account, uint256 _value) external;
}