// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.29;

import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { PausableUpgradeable        } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { OwnableUpgradeable         } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { IModuleBase                } from  "./interfaces/IModuleBase.sol";

import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";

// --- ModuleBase ---
// --- Base for all MasterVault modules with support of a single plugin ---
abstract contract ModuleBase is ReentrancyGuardUpgradeable, PausableUpgradeable, OwnableUpgradeable, IModuleBase {

    // --- Vars ---
    address public licensor;
    address public masterVault;
    address public plugin;

    // --- Mods ---
    modifier onlyOwnerOrVault() {
        require(_msgSender() == owner() || _msgSender() == masterVault, NotOwnerOrProvider());
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function __ModuleBase_init(address _masterVault, address _licensor) internal onlyInitializing {

        __ReentrancyGuard_init();
        __Pausable_init();
        __Ownable_init(_msgSender());

        licensor = _licensor;
        masterVault = _masterVault;
    }

    // --- Views ---
    function previewTotalAssets(uint256 assets) external view virtual returns (uint256) {

        return assets;
    }
    function asset() public view virtual returns (address);

    // --- Admin ---
    function changePlugin(address _newPlugin) external onlyOwner {

        address oldPlugin = plugin;
        plugin = _newPlugin;

        if (_newPlugin != address(0)) IERC20(asset()).approve(_newPlugin, type(uint256).max);
        if (oldPlugin != address(0)) IERC20(asset()).approve(oldPlugin, 0);

        emit PluginChanged(oldPlugin, _newPlugin);
    }
    function pause() external onlyOwner {

        _pause();
    }
    function unpause() external onlyOwner {

        _unpause();
    }
}