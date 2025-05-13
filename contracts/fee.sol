// SPDX-License-Identifier: AGPL-3.0-or-later
// Modified version of MakerDAO (https://github.com/makerdao/dss/blob/master/src/jug.sol)
pragma solidity ^0.8.10;

import "./dMath.sol";
import "./interfaces/FeeLike.sol";
import "./interfaces/LedgerLike.sol";
import "./interfaces/StablecoinJoinLike.sol";
import "./masterVault/interfaces/ILicensor.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// --- fee.sol --- Lending Fee
contract Fee is Initializable, FeeLike {
    // --- Auth ---
    mapping (address => uint) public wards;
    function rely(address usr) external auth { wards[usr] = 1; }
    function deny(address usr) external auth { wards[usr] = 0; }
    modifier auth {
        require(wards[msg.sender] == 1, "Fee/not-authorized");
        _;
    }

    // --- Data ---
    struct Ilk {
        uint256 duty;  // Collateral-specific, per-second stability fee contribution [ray]
        uint256  rho;  // Time of last drip [unix epoch time]
    }

    mapping (bytes32 => Ilk) public ilks;
    LedgerLike               public ledger;          // CDP Engine
    address                  public settlement;      // Debt Engine
    uint256                  public base;            // Global, per-second stability fee contribution [ray]
    address                  public stablecoinJoin;  // Stablecoin minter
    address                  public licensor;        // Royalty receiver

    event File(bytes32 indexed what, uint256 data);
    event File(bytes32 indexed what, address data);
    event File(bytes32 indexed ilk, bytes32 indexed what, uint256 data);

    // --- Init ---
    function initialize(address ledger_) external initializer {
        wards[msg.sender] = 1;
        ledger = LedgerLike(ledger_);
    }

    // --- Math ---
    function _add(uint x, uint y) internal pure returns (uint z) {
        unchecked {
            z = x + y;
            require(z >= x);
        }
    }
    function _diff(uint x, uint y) internal pure returns (int z) {
        unchecked {
            z = int(x) - int(y);
            require(int(x) >= 0 && int(y) >= 0);
        }
    }
    function _rmul(uint x, uint y) internal pure returns (uint z) {
        unchecked {
            z = x * y;
            require(y == 0 || z / y == x);
            z = z / dMath.ONE;
        }
    }
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Administration ---
    function init(bytes32 ilk) external auth {
        Ilk storage i = ilks[ilk];
        require(i.duty == 0, "Fee/ilk-already-init");
        i.duty = dMath.ONE;
        i.rho  = block.timestamp;
    }
    function file(bytes32 ilk, bytes32 what, uint data) external auth {
        require(block.timestamp == ilks[ilk].rho, "Fee/rho-not-updated");
        if (what == "duty") ilks[ilk].duty = data;
        else revert("Fee/file-unrecognized-param");
        emit File(ilk, what, data);
        
    }
    function file(bytes32 what, uint data) external auth {
        if (what == "base") base = data;
        else revert("Fee/file-unrecognized-param");
        emit File(what, data);
    }
    function file(bytes32 what, address data) external auth {
        if (what == "settlement") settlement = data;
        else if (what == "stablecoinJoin") {
            ledger.nope(stablecoinJoin);
            stablecoinJoin = data;
            ledger.hope(data);
        }
        else if (what == "licensor") licensor = data;
        else revert("Fee/file-unrecognized-param");
        emit File(what, data);
    }

    // --- Stability Fee Collection ---
    function drip(bytes32 ilk) external returns (uint rate) {

        require(block.timestamp >= ilks[ilk].rho, "Fee/invalid-now");
        (, uint prev,,,) = ledger.ilks(ilk);
        rate = _rmul(dMath.rpow(_add(base, ilks[ilk].duty), block.timestamp - ilks[ilk].rho, dMath.ONE), prev);

        int256 foldValue = _diff(rate, prev);

        if (foldValue < 0 || licensor == address(0)) {
            ledger.fold(ilk, settlement, foldValue);
        }
        else {
            uint256 x = ledger.stablecoin(address(this));
            ledger.fold(ilk, address(this), foldValue);
            uint256 y = ledger.stablecoin(address(this)) - x;

            uint256 royaltyMargin = ILicensor(licensor).sRoyaltyMargin();
            uint256 maxMargin = ILicensor(licensor).MAX_ROYALTY_MARGIN();

            uint256 royalty = y * royaltyMargin / maxMargin;

            ledger.move(address(this), settlement, y - royalty);

            royalty = royalty / 1e27;
            if (royalty > 0) StablecoinJoinLike(stablecoinJoin).exit(licensor, royalty / 1e27);
        }

        ilks[ilk].rho = block.timestamp;
    }
}