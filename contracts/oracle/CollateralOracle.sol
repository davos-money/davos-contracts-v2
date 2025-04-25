// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./extensions/CrossRateLstOracle.sol";

contract CollateralOracle is CrossRateLstOracle {

    function initialize(AggregatorV3Interface _aggregatorAddress, address _lst, IMasterVault _masterVault, IPriceController _priceController) external initializer {
        
        __LstOracle__init(_masterVault);
        __CrossRateLstOracle__init(_aggregatorAddress, _lst, _priceController);
    }
}