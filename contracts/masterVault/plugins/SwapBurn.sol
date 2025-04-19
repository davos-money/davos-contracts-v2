// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.29;

import { PluginBase } from  "./PluginBase.sol";

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IModuleBase } from "../modules/interfaces/IModuleBase.sol";
import { IERC20      } from "@openzeppelin/contracts/interfaces/IERC20.sol";

interface IVow {

    function feed(uint wad) external;
}

contract SwapBurn is PluginBase {

    using SafeERC20 for IERC20;

    ISwapRouter public immutable router;
    IQuoter public immutable quoter;
    AggregatorV3Interface public immutable priceFeed;

    address public vow;
    uint256 public maxSlippageBps;
    address public tokenOut;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

        // --- Init ---
    function initialize(address _vow) external initializer {

        __PluginBase_init();

        vow = _vow;
    }

    function beforeHook() external override returns (uint256) {

    }
    function afterHook() external override nonReentrant whenNotPaused returns (uint256) {

        IERC20 asset = IERC20(IModuleBase(_msgSender()).asset());
        uint256 balance = asset.balanceOf(_msgSender());

        asset.safeTransferFrom(_msgSender(), address(this), balance);

        swap(balance);
        feed(balance);
    }

    // --- SwapBurn ---
    function swap(uint256 amountIn) internal returns (uint256 amountOut) {

        require(amountIn > 0, "AmountIn = 0");

        IERC20 asset = IERC20(IModuleBase(_msgSender()).asset());
        asset.safeIncreaseAllowance(address(router), amountIn);

        address tokenIn = address(IModuleBase(_msgSender()).asset());

        IERC20(tokenIn).approve(address(router), amountIn);

        uint256 quotedOut = quoter.quoteExactInputSingle(
            tokenIn,
            tokenOut,
            1000,
            amountIn,
            0
        );

        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid oracle price");

        uint8 oracleDecimals = priceFeed.decimals();
        uint256 fairOut = (amountIn * uint256(price)) / (10 ** oracleDecimals);

        uint256 oracleSlippageOut = (fairOut * (10_000 - maxSlippageBps)) / 10_000;
        uint256 quotedSlippageOut = (quotedOut * (10_000 - maxSlippageBps)) / 10_000;

        uint256 minOut = oracleSlippageOut > quotedSlippageOut ? oracleSlippageOut : quotedSlippageOut;

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: 1000,
            recipient: _msgSender(),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0
        });

        amountOut = router.exactInputSingle(params);
    }
    function feed(uint256 _wad) internal returns (uint256) {

        IVow(vow).feed(_wad);
    }
}