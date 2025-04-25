// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../OracleBase.sol";

// get price using conversion of lst to value and using value price feed to USD
abstract contract CrossRateLstOracle is OracleBase {

    AggregatorV3Interface internal priceFeed; // price feed of value (ex. ETH/USD)
    address internal lsToken; // liquid staked token (ex. wstETH, ankrETH)
    IPriceController internal priceController; // for conversion

    function __CrossRateLstOracle__init(AggregatorV3Interface _aggregatorAddress, address _lsToken, IPriceController _priceController) internal onlyInitializing {
        lsToken = _lsToken;
        priceController = _priceController;
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
        // Get Staked Token equivalent to 1 LST and multiply with Staked Token price
        uint256 value = priceController.convertToAssets(lsToken, 1e18);
        uint256 lsTokenPrice = value * uint(price) / 10**priceFeed.decimals();
        return (lsTokenPrice, true);
    }
}