// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ILicensor          } from "./interfaces/ILicensor.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Licensor ---
// --- Collects and manages loyalty fees from users leveraging the protocol ---
contract Licensor is OwnableUpgradeable, ILicensor {

    // --- Constants ---
    uint256 public constant MAX_ROYALTY_MARGIN = 1e18;

    // --- Vars ---
    address public recipient;
    uint256 public sRoyaltyMargin;  // Stability Fee
    uint256 public vRoyaltyMargin;  // Vault's Yield

    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function initialize(address _recipient, uint256 _sRoyaltyMargin, uint256 _vRoyaltyMargin) external initializer {

        __Ownable_init(_msgSender());

        recipient = _recipient;
        sRoyaltyMargin = _sRoyaltyMargin;
        vRoyaltyMargin = _vRoyaltyMargin;

        require(_sRoyaltyMargin <= MAX_ROYALTY_MARGIN, MarginMoreThanMax(_sRoyaltyMargin));
        require(_vRoyaltyMargin <= MAX_ROYALTY_MARGIN, MarginMoreThanMax(_vRoyaltyMargin));

        emit SMarginSet(0, _sRoyaltyMargin);
        emit VMarginSet(0, _vRoyaltyMargin);
    }

    // --- Admin ---
    function pay(address _token, uint256 _amount) external onlyOwner {

        require(_token != address(0), ZeroAddress());
        require(_amount > 0, ZeroAmount());

        IERC20(_token).transfer(recipient, _amount);

        emit Payment(_token, _amount, recipient);
    }
    function setRecipient(address _newRecipient) external onlyOwner {

        require(_newRecipient != address(0), ZeroAddress());

        emit RecipientChanged(recipient, _newRecipient);

        recipient = _newRecipient;
    }
    function setRoyaltyMargins(uint256 _sRoyaltyMargin, uint256 _vRoyaltyMargin) external onlyOwner {

        require(_sRoyaltyMargin <= MAX_ROYALTY_MARGIN, MarginMoreThanMax(_sRoyaltyMargin));
        require(_vRoyaltyMargin <= MAX_ROYALTY_MARGIN, MarginMoreThanMax(_vRoyaltyMargin));

        emit SMarginSet(sRoyaltyMargin, _sRoyaltyMargin);
        emit VMarginSet(vRoyaltyMargin, _vRoyaltyMargin);

        sRoyaltyMargin = _sRoyaltyMargin;
        vRoyaltyMargin = _vRoyaltyMargin;
    }
}