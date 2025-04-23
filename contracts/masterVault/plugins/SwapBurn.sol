// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.29;

import { PluginBase } from  "./PluginBase.sol";

import { IModuleBase           } from "../modules/interfaces/IModuleBase.sol";
import { IYieldModule          } from "../modules/interfaces/IYieldModule.sol";
import { IPriceController      } from "../interfaces/IPriceController.sol";
import { IERC20                } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { IERC20Metadata        } from "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import { SafeERC20             } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import { Commands              } from "@uniswap/universal-router/contracts/libraries/Commands.sol";
import { Actions               } from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import { IV4Router             } from "@uniswap/v4-periphery/src/interfaces/IV4Router.sol";
import { IHooks                } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { Currency              } from "@uniswap/v4-core/src/types/Currency.sol";
import { PoolKey               } from "@uniswap/v4-core/src/types/PoolKey.sol";

interface IVow {
    function feed(uint wad) external;
}
interface IUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external;
}
interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

// --- SwapBurn ---
contract SwapBurn is PluginBase {

    // --- Wrappers ---
    using SafeERC20 for IERC20;

    // --- Constants ---
    uint256 public constant MAX = 1_000_000;  // Uniswap tier BPS 

    // --- Data ---
    IVow public vow;
    IUniversalRouter public router;
    IPermit2 public permit2;
    AggregatorV3Interface public priceFeed;

    address public tokenOut;
    uint24 public fee;
    int24 public tickSpacing;
    uint256 public deadline;
    uint256 public slippage;

    // --- Errors ---
    error InvalidOraclePrice(); 

    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function initialize(address _vow, address _router, address _permit2, address _priceFeed) external initializer {

        __PluginBase_init();

        vow = IVow(_vow);
        router = IUniversalRouter(_router);
        permit2 = IPermit2(_permit2);
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    // --- Plugins ---
    function beforeHook() external override returns (uint256) {

    }
    function afterHook() external override nonReentrant whenNotPaused returns (uint256) {

        IERC20 asset = IERC20(IModuleBase(_msgSender()).asset());

        uint128 balance = uint128(asset.balanceOf(_msgSender()));
        asset.safeTransferFrom(_msgSender(), address(this), balance);

        _feed(_swap(balance, _calculateMinAmount(address(asset), balance)));       
    }

    // --- Admin ---
    function setContracts(address _vow, address _router, address _permit2, address _priceFeed) external onlyOwner {
        
        vow = IVow(_vow);
        router = IUniversalRouter(_router);
        permit2 = IPermit2(_permit2);
        priceFeed = AggregatorV3Interface(_priceFeed);
    }
    function setParams(address _tokenOut, uint24 _fee, int24 _tickSpacing, uint256 _deadline, uint256 _slippage) external onlyOwner {

        tokenOut = _tokenOut;
        fee = _fee;
        tickSpacing = _tickSpacing;
        deadline = _deadline;
        slippage = _slippage;
    }

    // --- SwapBurn ---
    function _swap(uint128 amountIn, uint128 minAmountOut) internal returns (uint256) {

        IERC20 token = IERC20(IModuleBase(_msgSender()).asset());

        IERC20(token).approve(address(permit2), amountIn);
        permit2.approve(address(token), address(router), amountIn, uint48(block.timestamp + deadline));

        (PoolKey memory key, bool zeroForOne) = _getPoolKey(address(token), tokenOut);

        // Encode the Universal Router command
        bytes memory commands = abi.encodePacked(uint8(Commands.V4_SWAP));
        bytes[] memory inputs = new bytes[](1);

        // Encode V4Router actions
        bytes memory actions = abi.encodePacked(
            uint8(Actions.SWAP_EXACT_IN_SINGLE),
            uint8(Actions.SETTLE_ALL),
            uint8(Actions.TAKE_ALL)
        );

        // Prepare parameters for each action
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            IV4Router.ExactInputSingleParams({
                poolKey: key,
                zeroForOne: zeroForOne,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                hookData: bytes("")
            })
        );
        params[1] = abi.encode(key.currency0, amountIn);
        params[2] = abi.encode(key.currency1, minAmountOut);

        // Combine actions and params into inputs
        inputs[0] = abi.encode(actions, params);

        // Execute the swap
        router.execute(commands, inputs, block.timestamp + deadline);

        // Verify and return the output amount
        return IERC20(address(Currency.unwrap(key.currency1))).balanceOf(address(this));
    }
    function _feed(uint256 _wad) internal {

        IERC20(tokenOut).safeIncreaseAllowance(address(vow), type(uint256).max);
        IVow(vow).feed(_wad);
    }

    // --- Helper ---
    function _getPoolKey(address tokenA, address tokenB) internal view returns (PoolKey memory key, bool zeroForOne) {
    
        address lower = tokenA < tokenB ? tokenA : tokenB;
        address higher = tokenA < tokenB ? tokenB : tokenA;
    
        key = PoolKey({
            currency0: Currency.wrap(lower),
            currency1: Currency.wrap(higher),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(0))
        });

        zeroForOne = lower == tokenA;

    }
    function _calculateMinAmount(address _asset, uint256 _balance) internal returns (uint128) {

        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, InvalidOraclePrice());
        uint8 oracleDecimals = priceFeed.decimals();

        uint256 expanded = _priceController().convertToAssets(_asset, _balance);
        uint256 expandedPrice = (expanded * uint256(price)) / (10 ** oracleDecimals);
        uint256 expandedDecimal = uint128(expandedPrice / (10 ** (18  - IERC20Metadata(tokenOut).decimals())));

        return uint128(expandedDecimal - (expandedDecimal * (fee + slippage) / MAX));
    }
    function _priceController() internal view returns (IPriceController) {

        return IPriceController(IYieldModule(_msgSender()).priceController());
    }
}