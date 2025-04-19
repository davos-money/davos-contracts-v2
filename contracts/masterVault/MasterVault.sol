// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.29;

import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { PausableUpgradeable        } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { OwnableUpgradeable         } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ERC4626Upgradeable         } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import { IMasterVault               } from "./interfaces/IMasterVault.sol";

import { IERC20         } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { IModuleBase    } from  "./modules/interfaces/IModuleBase.sol";

// --- MasterVault ---
// --- Vault with instances per Liquid Staked Underlying to generate yield via ratio change and strategies ---
contract MasterVault is ReentrancyGuardUpgradeable, PausableUpgradeable, OwnableUpgradeable, ERC4626Upgradeable, IMasterVault {

    // --- Vars ---
    // uint256 public underlyings;   // totalAssets() + getVaultYield()
    address public davosProvider;

    IModuleBase[] public modules;
    mapping(address => bytes) public contexts; // _module to _data

    // --- Mods ---
    modifier onlyOwnerOrProvider() {

        require(_msgSender() == owner() || _msgSender() == davosProvider, NotOwnerOrProvider());
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function initialize(string memory _name, string memory _symbol, address _asset) external initializer {

        __ReentrancyGuard_init();
        __Pausable_init();
        __Ownable_init(_msgSender());
        __ERC20_init(_name, _symbol);
        __ERC4626_init(IERC20(_asset));
    }

    // --- Provider ---
    function deposit(uint256 assets, address receiver) public override nonReentrant whenNotPaused onlyOwnerOrProvider returns (uint256) {

        address src = _msgSender();

        require(assets > 0, InvalidAssets());
        require(receiver != address(0), ZeroAddress());
        require(assets <= maxDeposit(src), ERC4626ExceededMaxDeposit(receiver, assets, maxDeposit(src)));

        // before
        _callModules(IModuleBase.beforeDeposit.selector, abi.encode(assets, receiver));

        uint256 shares = previewDeposit(assets);
        _deposit(src, src, assets, shares);
        // underlyings += assets;

        // after
        _callModules(IModuleBase.afterDeposit.selector, abi.encode(assets, shares, receiver));
        
        return shares;
    }
    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant whenNotPaused onlyOwnerOrProvider returns (uint256) {

        address src = _msgSender();

        require(shares > 0, InvalidShares());
        require(receiver != address(0), ZeroAddress());
        require(shares <= maxRedeem(owner), ERC4626ExceededMaxRedeem(owner, shares, maxRedeem(owner)));

        uint256 assets = previewRedeem(shares);

        // before
        _callModules(IModuleBase.beforeRedeem.selector, abi.encode(shares, receiver));

        // underlyings -= assets;
        _withdraw(owner, receiver, owner, assets, shares);

        // after
        _callModules(IModuleBase.afterRedeem.selector, abi.encode(assets, shares, receiver));

        return assets;
    }
    function mint(uint256 shares, address receiver) public override nonReentrant whenNotPaused onlyOwnerOrProvider returns (uint256) { 

        address src = _msgSender();
        uint256 maxShares = maxMint(receiver);

        require(shares <= maxShares, ERC4626ExceededMaxMint(receiver, shares, maxShares));
        
        // before
        _callModules(IModuleBase.beforeMint.selector, abi.encode(shares, receiver));

        uint256 assets = previewMint(shares);
        _deposit(src, src, assets, shares);

        // after
        _callModules(IModuleBase.afterMint.selector, abi.encode(assets, shares, receiver));

        return assets;
    }
    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant whenNotPaused onlyOwnerOrProvider returns (uint256) { 

        address src = _msgSender();
        uint256 maxAssets = maxWithdraw(owner);

        require(assets <= maxAssets, ERC4626ExceededMaxWithdraw(owner, assets, maxAssets));

        uint256 shares = previewWithdraw(assets);

        // before
        _callModules(IModuleBase.beforeWithdraw.selector, abi.encode(shares, receiver));
                
        _withdraw(owner, receiver, owner, assets, shares);

        // after
        _callModules(IModuleBase.afterWithdraw.selector, abi.encode(assets, shares, receiver));

        return shares;
    }
    function _callModules(bytes4 _selector, bytes memory _data) internal {
        
        bool success;

        for (uint256 i = 0; i < modules.length; i++) {

            (success, ) = address(modules[i]).call(abi.encodeWithSelector(_selector, _data, contexts[address(modules[i])]));
            require(success, ModuleCallFailed()); 
        }
    }
    
    // --- Admin ---
    function changeDavosProvider(address _newProvider) external onlyOwner {

        require(_newProvider != address(0), ZeroAddress());
        address oldProvider = davosProvider;
        davosProvider = _newProvider;

        emit DavosProviderChanged(oldProvider, _newProvider);
    }
    function addModule(address _module, bytes memory _context) external onlyOwner {

        require(_module != address(0), ZeroAddress());
        modules.push(IModuleBase(_module));
        contexts[_module] = _context;

        IModuleBase(_module).setup();
        IERC20(asset()).approve(_module, type(uint256).max);

        emit ModuleAdded(_module, _context);
    }
    function setContext(address _module, bytes memory _context) external onlyOwner {

        require(_module != address(0), ZeroAddress());
        bytes memory oldContext = contexts[_module];
        contexts[_module] = _context;

        emit ContextChanged(_module, oldContext, _context);
    }
    function pause() external onlyOwner {

        _pause();
    }
    function unpause() external onlyOwner {

        _unpause();
    }

    // --- Overrides ---
    function totalAssets() public view virtual override returns (uint256 assets) {

        // assets = underlyings;
        assets = super.totalAssets();

        for (uint256 i = 0; i < modules.length; i++)
            assets = modules[i].previewTotalAssets(assets);
    }
}