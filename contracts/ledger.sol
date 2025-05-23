// SPDX-License-Identifier: AGPL-3.0-or-later
// Modified version of MakerDAO (https://github.com/makerdao/dss/blob/master/src/vat.sol)
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/LedgerLike.sol";

// --- ledger.sol --- CDP Engine
contract Ledger is LedgerLike, Initializable {

    // --- Auth ---
    mapping (address => uint) public wards;
    function rely(address usr) external auth { require(live == 1, "Ledger/not-live"); wards[usr] = 1; }
    function deny(address usr) external auth { require(live == 1, "Ledger/not-live"); wards[usr] = 0; }
    modifier auth {
        require(wards[msg.sender] == 1, "Ledger/not-authorized");
        _;
    }

    mapping(address => mapping (address => uint)) public can;
    function behalf(address bit, address usr) external auth { can[bit][usr] = 1; }
    function regard(address bit, address usr) external auth { can[bit][usr] = 0; }
    function hope(address usr) external { can[msg.sender][usr] = 1; }
    function nope(address usr) external { can[msg.sender][usr] = 0; }
    function wish(address bit, address usr) internal view returns (bool) {
        return either(bit == usr, can[bit][usr] == 1);
    }

    // --- Data ---
    struct Ilk {
        uint256 Art;     // Total Normalised Debt     [wad]
        uint256 rate;    // Accumulated Rates         [ray]
        uint256 vision;  // Price with Safety Margin  [ray]
        uint256 line;    // Debt Ceiling              [rad]
        uint256 dust;    // Urn Debt Floor            [rad]
    }
    struct Urn {
        uint256 ink;   // Locked Collateral  [wad]
        uint256 art;   // Normalised Debt    [wad]
    }

    mapping (bytes32 => Ilk)                       public ilks;
    mapping (bytes32 => mapping (address => Urn )) public urns;
    mapping (bytes32 => mapping (address => uint)) public gem;         // [wad]
    mapping (address => uint256)                   public stablecoin;  // [rad]
    mapping (address => uint256)                   public sin;         // [rad]

    uint256 public debt;  // Total Stablecoin Issued    [rad]
    uint256 public vice;  // Total Unbacked Stablecoin  [rad]
    uint256 public Line;  // Total Debt Ceiling         [rad]
    uint256 public live;  // Active Flag

    event File(bytes32 indexed what, uint256 data);
    event File(bytes32 indexed ilk, bytes32 indexed what, uint256 data);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function initialize() external initializer {
        wards[msg.sender] = 1;
        live = 1;
    }

    // --- Math ---
    function _add(uint x, int y) internal pure returns (uint z) {
        unchecked {
            z = x + uint(y);
            require(y >= 0 || z <= x);
            require(y <= 0 || z >= x);
        }
    }
    function _sub(uint x, int y) internal pure returns (uint z) {
        unchecked {
            z = x - uint(y);
            require(y <= 0 || z <= x);
            require(y >= 0 || z >= x);
        }
    }
    function _mul(uint x, int y) internal pure returns (int z) {
        unchecked {
            z = int(x) * y;
            require(int(x) >= 0);
            require(y == 0 || z / y == int(x));
        }
    }
    function _add(uint x, uint y) internal pure returns (uint z) {
        unchecked {
            require((z = x + y) >= x);
        }
    }
    function _sub(uint x, uint y) internal pure returns (uint z) {
        unchecked {
            require((z = x - y) <= x);
        }
    }
    function _mul(uint x, uint y) internal pure returns (uint z) {
        unchecked {
            require(y == 0 || (z = x * y) / y == x);
        }
    }

    // --- Administration ---
    function init(bytes32 ilk) external auth {
        require(ilks[ilk].rate == 0, "Ledger/ilk-already-init");
        ilks[ilk].rate = 10 ** 27;
    }
    function file(bytes32 what, uint data) external auth {
        require(live == 1, "Ledger/not-live");
        if (what == "Line") Line = data;
        else revert("Ledger/file-unrecognized-param");
        emit File(what, data);
    }
    function file(bytes32 ilk, bytes32 what, uint data) external auth {
        require(live == 1, "Ledger/not-live");
        if (what == "vision") ilks[ilk].vision = data;
        else if (what == "line") ilks[ilk].line = data;
        else if (what == "dust") ilks[ilk].dust = data;
        else revert("Ledger/file-unrecognized-param");
        emit File(ilk, what, data);
    }
    function cage() external auth {
        live = 0;
    }

    function uncage() external auth {
        live = 1;
    }

    // --- Fungibility ---
    function slip(bytes32 ilk, address usr, int256 wad) external auth {
        gem[ilk][usr] = _add(gem[ilk][usr], wad);
    }
    function flux(bytes32 ilk, address src, address dst, uint256 wad) external auth {
        require(wish(src, msg.sender), "Ledger/not-allowed");
        gem[ilk][src] = _sub(gem[ilk][src], wad);
        gem[ilk][dst] = _add(gem[ilk][dst], wad);
    }
    function move(address src, address dst, uint256 rad) external auth {
        require(wish(src, msg.sender), "Ledger/not-allowed");
        stablecoin[src] = _sub(stablecoin[src], rad);
        stablecoin[dst] = _add(stablecoin[dst], rad);
    }

    function either(bool x, bool y) internal pure returns (bool z) {
        assembly{ z := or(x, y)}
    }
    function both(bool x, bool y) internal pure returns (bool z) {
        assembly{ z := and(x, y)}
    }

    // --- CDP Manipulation ---
    function frob(bytes32 i, address u, address v, address w, int dink, int dart) external auth {
        // system is live
        require(live == 1, "Ledger/not-live");

        Urn memory urn = urns[i][u];
        Ilk memory ilk = ilks[i];
        // ilk has been initialised
        require(ilk.rate != 0, "Ledger/ilk-not-init");

        urn.ink = _add(urn.ink, dink);
        urn.art = _add(urn.art, dart);
        ilk.Art = _add(ilk.Art, dart);

        int dtab = _mul(ilk.rate, dart);
        uint tab = _mul(ilk.rate, urn.art);
        debt     = _add(debt, dtab);

        // either debt has decreased, or debt ceilings are not exceeded
        require(either(dart <= 0, both(_mul(ilk.Art, ilk.rate) <= ilk.line, debt <= Line)), "Ledger/ceiling-exceeded");
        // urn is either less risky than before, or it is safe
        require(either(both(dart <= 0, dink >= 0), tab <= _mul(urn.ink, ilk.vision)), "Ledger/not-safe");

        // urn is either more safe, or the owner consents
        require(either(both(dart <= 0, dink >= 0), wish(u, msg.sender)), "Ledger/not-allowed-u");
        // collateral src consents
        require(either(dink <= 0, wish(v, msg.sender)), "Ledger/not-allowed-v");
        // debt dst consents
        require(either(dart >= 0, wish(w, msg.sender)), "Ledger/not-allowed-w");

        // urn has no debt, or a non-dusty amount
        require(either(urn.art == 0, tab >= ilk.dust), "Ledger/dust");

        gem[i][v] = _sub(gem[i][v], dink);
        stablecoin[w]    = _add(stablecoin[w],    dtab);

        urns[i][u] = urn;
        ilks[i]    = ilk;
    }

    // --- CDP Fungibility ---
    function fork(bytes32 ilk, address src, address dst, int dink, int dart) external auth {
        Urn storage u = urns[ilk][src];
        Urn storage v = urns[ilk][dst];
        Ilk storage i = ilks[ilk];

        u.ink = _sub(u.ink, dink);
        u.art = _sub(u.art, dart);
        v.ink = _add(v.ink, dink);
        v.art = _add(v.art, dart);

        uint utab = _mul(u.art, i.rate);
        uint vtab = _mul(v.art, i.rate);

        // both sides consent
        require(both(wish(src, msg.sender), wish(dst, msg.sender)), "Ledger/not-allowed");

        // both sides safe
        require(utab <= _mul(u.ink, i.vision), "Ledger/not-safe-src");
        require(vtab <= _mul(v.ink, i.vision), "Ledger/not-safe-dst");

        // both sides non-dusty
        require(either(utab >= i.dust, u.art == 0), "Ledger/dust-src");
        require(either(vtab >= i.dust, v.art == 0), "Ledger/dust-dst");
    }

    // --- CDP Confiscation ---
    function grab(bytes32 i, address u, address v, address w, int dink, int dart) external auth {
        Urn storage urn = urns[i][u];
        Ilk storage ilk = ilks[i];

        urn.ink = _add(urn.ink, dink);
        urn.art = _add(urn.art, dart);
        ilk.Art = _add(ilk.Art, dart);

        int dtab = _mul(ilk.rate, dart);

        gem[i][v] = _sub(gem[i][v], dink);
        sin[w]    = _sub(sin[w],    dtab);
        vice      = _sub(vice,      dtab);
    }

    // --- Settlement ---
    function heal(uint rad) external {
        address u = msg.sender;
        sin[u] = _sub(sin[u], rad);
        stablecoin[u] = _sub(stablecoin[u], rad);
        vice   = _sub(vice,   rad);
        debt   = _sub(debt,   rad);
    }
    function suck(address u, address v, uint rad) external auth {
        sin[u] = _add(sin[u], rad);
        stablecoin[v] = _add(stablecoin[v], rad);
        vice   = _add(vice,   rad);
        debt   = _add(debt,   rad);
    }

    // --- Rates ---
    function fold(bytes32 i, address u, int rate) external auth {
        require(live == 1, "Ledger/not-live");
        Ilk storage ilk = ilks[i];
        ilk.rate = _add(ilk.rate, rate);
        int rad  = _mul(ilk.Art, rate);
        stablecoin[u]   = _add(stablecoin[u], rad);
        debt     = _add(debt,   rad);
    }
}
