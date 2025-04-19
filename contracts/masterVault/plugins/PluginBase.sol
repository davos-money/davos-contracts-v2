// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.29;

import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { PausableUpgradeable        } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { OwnableUpgradeable         } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { IPluginBase                } from  "./interfaces/IPluginBase.sol";

// --- PluginBase ---
// --- Base for YieldModule plugins to call on claim ---
abstract contract PluginBase is ReentrancyGuardUpgradeable, PausableUpgradeable, OwnableUpgradeable, IPluginBase {

    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function __PluginBase_init() internal onlyInitializing {

        __Ownable_init(_msgSender());
        __Pausable_init();
        __ReentrancyGuard_init();
    }

    // --- Admin ---
    function pause() external onlyOwner {

        _pause();
    }
    function unpause() external onlyOwner {

        _unpause();
    }
}