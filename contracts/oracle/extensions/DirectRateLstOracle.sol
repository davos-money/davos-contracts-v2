// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

import "../OracleBase.sol";

abstract contract DirectRateLstOracle is OracleBase {

    AggregatorV3Interface internal priceFeed; // direct price feed of liquid staked token (ex. swETH/USD)

    function __DirectRateLstOracle__init(AggregatorV3Interface _aggregatorAddress) internal onlyInitializing {
        priceFeed = _aggregatorAddress;
    }

    function _peekLstPrice() internal override view returns (uint256, bool) {
        (
        /*uint80 roundID*/,
        int price,
        /*uint startedAt*/,
        /*uint timeStamp*/,
        /*uint80 answeredInRound*/
        ) = priceFeed.latestRoundData();
        if (price < 0) {
            return (0, false);
        }
        uint256 lstPrice = uint256(price) * 10**masterVault.decimals() / 10**priceFeed.decimals();
        return (lstPrice, true);
    }
}