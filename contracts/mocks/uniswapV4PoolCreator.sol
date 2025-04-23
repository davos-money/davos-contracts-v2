// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IAllowanceTransfer} from "@uniswap/permit2/src/interfaces/IAllowanceTransfer.sol";
import "@uniswap/v4-core/src/types/PoolId.sol";
import {IStateView} from "@uniswap/v4-periphery/src/interfaces/IStateView.sol";

import "hardhat/console.sol";
interface PositionManager {
    function initializePool(PoolKey calldata key, uint160 sqrtPriceX96) external payable returns (int24);
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);
}

contract UniswapV4PoolCreator {

    using CurrencyLibrary for Currency;

    /////////////////////////////////////
    // --- Parameters to Configure --- //
    /////////////////////////////////////

    // --- pool configuration --- //
    // fees paid by swappers that accrue to liquidity providers
    uint24 lpFee = 3000; // 0.30%
    int24 tickSpacing = 60;

    // starting price of the pool, in sqrtPriceX96
    uint160 startingPrice = 3483129096672632738239838422703; // floor(sqrt(1) * 2^96)

    // --- liquidity position configuration --- //
    uint256 public token0Amount = 2e18;
    uint256 public token1Amount = 4000e18;

    // range of the position
    int24 tickLower = 75600; // must be a multiple of tickSpacing
    int24 tickUpper = 75720;

    //
    IPoolManager constant POOLMANAGER = IPoolManager(address(0x000000000004444c5dc75cB358380D2e3dE08A90));
    PositionManager constant posm = PositionManager(payable(address(0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e)));
    IAllowanceTransfer constant PERMIT2 = IAllowanceTransfer(address(0x000000000022D473030F116dDEE9F6B43aC78BA3));

    IERC20 token0;
    IERC20 token1;

    address tokenA;
    address tokenB;

    address lower;
    address higher;

    IHooks hookContract;
    Currency currency0;
    Currency currency1;
    /////////////////////////////////////

    constructor(address _token0, address _token1) {
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }
    function run() external {
        tokenA = address(token0);
        tokenB = address(token1);

        lower = tokenA < tokenB ? tokenA : tokenB;
        higher = tokenA < tokenB ? tokenB : tokenA;

        currency0 = Currency.wrap(lower);
        currency1 = Currency.wrap(higher);
        hookContract = IHooks(address(0x0));

        // tokens should be sorted
        PoolKey memory pool = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: lpFee,
            tickSpacing: tickSpacing,
            hooks: hookContract
        });
        bytes memory hookData = new bytes(0);

        // --------------------------------- //

        // Converts token amounts to liquidity units
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            startingPrice,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            token0Amount,
            token1Amount
        );

        // slippage limits
        uint256 amount0Max = token0Amount + 1 wei;
        uint256 amount1Max = token1Amount + 1 wei;

        (bytes memory actions, bytes[] memory mintParams) =
            _mintLiquidityParams(pool, tickLower, tickUpper, liquidity, amount0Max, amount1Max, address(this), hookData);

        // multicall parameters
        bytes[] memory params = new bytes[](2);

        // initialize pool
        params[0] = abi.encodeWithSelector(posm.initializePool.selector, pool, startingPrice, hookData);

        // mint liquidity
        params[1] = abi.encodeWithSelector(
            posm.modifyLiquidities.selector, abi.encode(actions, mintParams), block.timestamp + 60
        );

        // if the pool is an ETH pair, native tokens are to be transferred
        uint256 valueToPass = currency0.isAddressZero() ? amount0Max : 0;

        tokenApprovals();

        // multicall to atomically create pool & add liquidity
        posm.multicall{value: valueToPass}(params);
    }

    /// @dev helper function for encoding mint liquidity operation
    /// @dev does NOT encode SWEEP, developers should take care when minting liquidity on an ETH pair
    function _mintLiquidityParams(
        PoolKey memory poolKey,
        int24 _tickLower,
        int24 _tickUpper,
        uint256 liquidity,
        uint256 amount0Max,
        uint256 amount1Max,
        address recipient,
        bytes memory hookData
    ) internal pure returns (bytes memory, bytes[] memory) {
        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));

        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(poolKey, _tickLower, _tickUpper, liquidity, amount0Max, amount1Max, recipient, hookData);
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1);
        return (actions, params);
    }

    function tokenApprovals() public {
        if (!currency0.isAddressZero()) {
            token0.approve(address(PERMIT2), type(uint256).max);
            PERMIT2.approve(address(token0), address(posm), type(uint160).max, type(uint48).max);
        }
        if (!currency1.isAddressZero()) {
            token1.approve(address(PERMIT2), type(uint256).max);
            PERMIT2.approve(address(token1), address(posm), type(uint160).max, type(uint48).max);
        }
    }

    function poolExists() external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFeeR) {

        IStateView sv = IStateView(address(0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227));

        // tokens should be sorted
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: lpFee,
            tickSpacing: tickSpacing,
            hooks: hookContract
        });

        (sqrtPriceX96, tick, protocolFee, lpFeeR) = sv.getSlot0(PoolIdLibrary.toId(key));
    }
}