// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.29;

import { ModuleBase   } from  "./ModuleBase.sol";
import { IYieldModule } from  "./interfaces/IYieldModule.sol";

import { IERC20           } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { IERC4626         } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import { SafeERC20        } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IPriceController } from "../interfaces/IPriceController.sol";
import { IPluginBase      } from "../plugins/interfaces/IPluginBase.sol";
import { ILicensor        } from "../interfaces/ILicensor.sol";

// --- YieldModule ---
// --- Enables tracking and collection of yield from MasterVault ---
contract YieldModule is ModuleBase, IYieldModule {

    using SafeERC20 for IERC20;
    
    // --- Vars ---
    uint256 public yieldMargin;      // Percentage of Yield protocol gets, 10,000 = 100%
    uint256 public yieldBalance;
    uint256 public yieldReserved;
    address public priceController;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function initialize(address _masterVault, address _licensor, uint256 _yieldMargin) external initializer {

        __ModuleBase_init(_masterVault, _licensor);

        require(_yieldMargin <= 1e4, MoreThanMax());
        yieldMargin = _yieldMargin;

        emit YieldMarginSet(0, _yieldMargin);
    }

    // --- Public ---
    function claimYield() external nonReentrant whenNotPaused returns (uint256 yield) {

        yield = _claimYield();
        _updateYieldBalance();
    }
    function _claimYield() internal returns (uint256) {

        _beforeClaim();
        
        uint256 availableYields = getVaultYield() + yieldReserved;
        if (availableYields <= 0) return 0;
        if (yieldReserved != 0) yieldReserved = 0;

        IERC20 _asset = IERC20(asset());
        _asset.safeTransferFrom(masterVault, address(this), availableYields);
        
        uint256 royalty = getYieldRoyalty(availableYields);
        _asset.safeTransfer(licensor, royalty);

        _afterClaim();

        emit YieldClaimed(availableYields - royalty, royalty, licensor);

        return availableYields;
    }
    function _reserveYield() internal returns (uint256) {

        uint256 availableYields = getVaultYield();
        if (availableYields > 0) yieldReserved += availableYields;
    }
    function _beforeClaim() internal {

        if (plugin != address(0)) plugin.call(abi.encodeWithSelector(IPluginBase.beforeHook.selector));
     }
    function _afterClaim() internal {
        
        if (plugin != address(0)) plugin.call(abi.encodeWithSelector(IPluginBase.afterHook.selector));
    }
    function _updateYieldBalance() internal {

        yieldBalance = expandUnderlyings();
    }
    
    // --- Admin ---
    function changeYieldMargin(uint256 _newMargin) external onlyOwner {

        require(_newMargin <= 1e4, MoreThanMax());
        uint256 oldMargin = _newMargin;
        yieldMargin = _newMargin;

        emit YieldMarginSet(oldMargin, _newMargin);
    }
    function changePriceController(address _newController) external onlyOwner {

        require(_newController != address(0), ZeroAddress());
        address oldAdatper = priceController;
        priceController = _newController;

        emit PriceControllerChanged(oldAdatper, _newController);
    }

    // --- Views ---
    function getVaultYield() public view returns (uint256) {

        uint256 totalBalance = expandUnderlyings();
        if (totalBalance <= yieldBalance) return 0;

        uint256 diffBalance = totalBalance - yieldBalance;

        uint256 yield = diffBalance * yieldMargin / 1e4;

        return IPriceController(priceController).convertToShares(asset(), yield);
    }
    function getYieldRoyalty(uint256 yield) public view returns (uint256) {

        uint256 royaltyMargin = ILicensor(licensor).vRoyaltyMargin();
        uint256 maxMargin = ILicensor(licensor).MAX_ROYALTY_MARGIN();

        return yield * royaltyMargin / maxMargin;
    }
    function expandUnderlyings() public view returns (uint256) {

        return IPriceController(priceController).convertToAssets(asset(), IERC20(asset()).balanceOf(masterVault));
    }

    // --- ModuleBase ---
    function asset() public view override returns (address) {

        return IERC4626(masterVault).asset();
    }
    function setup() external override virtual onlyOwnerOrVault {
        
        yieldBalance = expandUnderlyings();
    }

    function beforeDeposit(bytes memory _data, bytes memory _context) external {

        _reserveYield();
    }
    function beforeRedeem(bytes memory _data, bytes memory _context) external {

        _reserveYield();
    }
    function beforeMint(bytes memory _data, bytes memory _context) external {

        _reserveYield();
    }
    function beforeWithdraw(bytes memory _data, bytes memory _context) external {

        _reserveYield();
    }

    function afterDeposit(bytes memory _data, bytes memory _context) external {

        _updateYieldBalance();
    }
    function afterRedeem(bytes memory _data, bytes memory _context) external {

        _updateYieldBalance();
    }
    function afterMint(bytes memory _data, bytes memory _context) external {

        _updateYieldBalance();
    }
    function afterWithdraw(bytes memory _data, bytes memory _context) external {

        _updateYieldBalance();
    }

    function previewTotalAssets(uint256 _underlyings) external view override returns (uint256 _actualAssets) {

        _actualAssets = _underlyings - getVaultYield() - yieldReserved;
    }
}