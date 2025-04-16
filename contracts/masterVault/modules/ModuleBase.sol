// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.29;

import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { PausableUpgradeable        } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { OwnableUpgradeable         } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { IModuleBase                } from  "./interfaces/IModuleBase.sol";

// --- ModuleBase ---
// --- Base for all MasterVault modules with support of a single plugin ---
abstract contract ModuleBase is ReentrancyGuardUpgradeable, PausableUpgradeable, OwnableUpgradeable, IModuleBase {

    // --- Vars ---
    address public licensor;
    address public masterVault;
    address public plugin;

    // --- Mods ---
    modifier onlyOwnerOrVault() {
        require(_msgSender() == owner() || _msgSender() == masterVault, NotOwnerOrDavosProvider());
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function __ModuleBase_init(address _licensor) internal onlyInitializing {

        __Ownable_init(_msgSender());
        __Pausable_init();
        __ReentrancyGuard_init();

        licensor = _licensor;
    }

    function asset() external view virtual returns (address);
    function previewTotalAssets(uint256 assets) external view virtual returns (uint256) {

        return assets;
    }

    // --- Admin ---
    function pause() external onlyOwner {

        _pause();
    }
    function unpause() external onlyOwner {

        _unpause();
    }
}