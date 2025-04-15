// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.29;

import { ModuleBase   } from  "./ModuleBase.sol";
import { IYieldModule } from  "./interfaces/IYieldModule.sol";

import { IERC20        } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { IERC4626      } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import { SafeERC20     } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IRatioAdapter } from "../interfaces/IRatioAdapter.sol";
import { IPluginBase   } from "../plugins/interfaces/IPluginBase.sol";
import { ILicensor     } from "../interfaces/ILicensor.sol";

// --- YieldModule ---
// --- Enables tracking and collection of yield from MasterVault ---
contract YieldModule is ModuleBase, IYieldModule {

    using SafeERC20 for IERC20;
    
    // --- Vars ---
    uint256 public yieldMargin;        // Percentage of Yield protocol gets, 10,000 = 100%
    uint256 public yieldBalance;
    IRatioAdapter public ratioAdapter;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function initialize(uint256 _yieldMargin) external initializer {

        __ModuleBase_init();

        require(_yieldMargin <= 1e4, MoreThanMax());
        yieldMargin = _yieldMargin;

        emit YieldMarginSet(0, _yieldMargin);
    }

    function claimYield() external nonReentrant whenNotPaused returns (uint256 yield) {

        yield = _claimYield();
    }
    function _claimYield() internal returns (uint256) {

        _beforeClaim();
        
        uint256 availableYields = getVaultYield();
        if (availableYields <= 0) return 0;

        IERC20 _asset = IERC20(asset());
        _asset.safeTransferFrom(masterVault, address(this), availableYields);
        
        uint256 royalty = getYieldRoyalty(availableYields);
        _asset.safeTransfer(licensor, royalty);

        _afterClaim();

        emit YieldClaimed(availableYields - royalty, royalty, licensor);

        return availableYields;
    }
    function _beforeClaim() internal {

        IPluginBase(plugin).beforeClaim();
    }
    function _afterClaim() internal {

        IPluginBase(plugin).afterClaim();
    }
    function updateYieldBalance() internal {

        yieldBalance = expandUnderlyings();
    }
    
    // --- Admin ---
    function changeYieldMargin(uint256 _newMargin) external onlyOwner {

        require(_newMargin <= 1e4, MoreThanMax());
        uint256 oldMargin = _newMargin;
        yieldMargin = _newMargin;

        emit YieldMarginSet(oldMargin, _newMargin);
    }
    function changeAdapter(address _newAdapter) external onlyOwner {

        require(_newAdapter != address(0), ZeroAddress());
        address oldAdatper = address(ratioAdapter);
        ratioAdapter = IRatioAdapter(_newAdapter);

        emit RatioAdapterChanged(oldAdatper, _newAdapter);
    }
    function changePlugin(address _newPlugin) external onlyOwner {

        require(_newPlugin != address(0), ZeroAddress());
        address oldPlugin = plugin;
        plugin = _newPlugin;

        emit PluginChanged(oldPlugin, _newPlugin);
    }

    // --- Views ---
    function getVaultYield() public view returns (uint256) {

        uint256 totalBalance = expandUnderlyings();
        if (totalBalance <= yieldBalance) return 0;

        uint256 diffBalance = totalBalance - yieldBalance;

        uint256 yield = diffBalance * yieldMargin / 1e4;

        return ratioAdapter.fromValue(asset(), yield);
    }
    function getYieldRoyalty(uint256 yield) public view returns (uint256) {

        uint256 royaltyMargin = ILicensor(licensor).vRoyaltyMargin();
        uint256 maxMargin = ILicensor(licensor).MAX_ROYALTY_MARGIN();

        return yield * royaltyMargin / maxMargin;
    }
    function expandUnderlyings() public view returns (uint256) {

        return ratioAdapter.toValue(asset(), IERC20(asset()).balanceOf(address(masterVault)));
    }
    function asset() public view override returns (address) {

        IERC4626(masterVault).asset();
    }

    // --- ModuleBase ---
    function beforeDeposit(bytes memory _data, bytes memory _context) external {

        _claimYield();
    }
    function beforeRedeem(bytes memory _data, bytes memory _context) external {

        _claimYield();
    }
    function beforeMint(bytes memory _data, bytes memory _context) external {

        _claimYield();
    }
    function beforeWithdraw(bytes memory _data, bytes memory _context) external {

        _claimYield();
    }

    function afterDeposit(bytes memory _data, bytes memory _context) external {

        updateYieldBalance();
    }
    function afterRedeem(bytes memory _data, bytes memory _context) external {

        updateYieldBalance();
    }
    function afterMint(bytes memory _data, bytes memory _context) external {

        updateYieldBalance();
    }
    function afterWithdraw(bytes memory _data, bytes memory _context) external {

        updateYieldBalance();
    }

    function previewTotalAssets(uint256 _underlyings) external view override returns (uint256 _actualAssets) {

        _actualAssets = _underlyings - getVaultYield();
    }
}