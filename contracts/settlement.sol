// SPDX-License-Identifier: AGPL-3.0-or-later
// Modified version of MakerDAO (https://github.com/makerdao/dss/blob/master/src/vow.sol)
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./interfaces/LedgerLike.sol";
import "./interfaces/StablecoinJoinLike.sol";

// --- settlement.sol --- Settlement Module
contract Settlement is Initializable{
    
    // --- Auth ---
    mapping (address => uint) public wards;
    function rely(address usr) external auth { require(live == 1, "Settlement/not-live"); wards[usr] = 1; }
    function deny(address usr) external auth { wards[usr] = 0; }
    modifier auth {
        require(wards[msg.sender] == 1, "Settlement/not-authorized");
        _;
    }

    // --- Data ---
    LedgerLike public ledger;  // CDP Engine
    address public multisig;   // Surplus multisig 

    address public stablecoinJoin;  // Stablecoin address
    uint256 public hump;            // Surplus buffer      [rad]

    uint256 public live;  // Active Flag

    address public stablecoin;  // Stablecoin token

    event File(bytes32 indexed what, uint256 data);
    event File(bytes32 indexed what, address data);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function initialize(address ledger_, address _stablecoinJoin, address multisig_) external initializer {
        wards[msg.sender] = 1;
        ledger = LedgerLike(ledger_);
        stablecoinJoin = _stablecoinJoin;
        multisig = multisig_;
        ledger.hope(stablecoinJoin);
        live = 1;
    }

    // --- Math ---
    function min(uint x, uint y) internal pure returns (uint z) {
        return x <= y ? x : y;
    }

    // --- Administration ---
    function file(bytes32 what, uint data) external auth {
        if (what == "hump") hump = data;
        else revert("Settlement/file-unrecognized-param");
        emit File(what, data);
    }
    function file(bytes32 what, address data) external auth {
        if (what == "multisig") multisig = data;
        else if (what == "stablecoinjoin") { 
            ledger.nope(stablecoinJoin);
            stablecoinJoin = data;
            ledger.hope(stablecoinJoin);
        }
        else if (what == "stablecoin") stablecoin = data;
        else if (what == "ledger") ledger = LedgerLike(data);
        else revert("Settlement/file-unrecognized-param");
        emit File(what, data);
    }

    // Debt settlement
    function heal(uint rad) external {
        require(rad <= ledger.stablecoin(address(this)), "Settlement/insufficient-surplus");
        require(rad <= ledger.sin(address(this)), "Settlement/insufficient-debt");
        ledger.heal(rad);
    }

    // Feed stablecoin to settlement
    function feed(uint wad) external {
        IERC20(stablecoin).transferFrom(msg.sender, address(this), wad);
        IERC20(stablecoin).approve(stablecoinJoin, wad);
        StablecoinJoinLike(stablecoinJoin).join(address(this), wad);
    }
    // Send surplus to multisig
    function flap() external {
        require(ledger.stablecoin(address(this)) >= ledger.sin(address(this)) + hump, "Settlement/insufficient-surplus");
        uint rad = ledger.stablecoin(address(this)) - (ledger.sin(address(this)) + hump);
        uint wad = rad / 1e27;
        StablecoinJoinLike(stablecoinJoin).exit(multisig, wad);
    }

    function cage() external auth {
        require(live == 1, "Settlement/not-live");
        live = 0;
        ledger.heal(min(ledger.stablecoin(address(this)), ledger.sin(address(this))));
    }

    function uncage() external auth {
        require(live == 0, "Settlement/live");
        live = 1;
    }
}