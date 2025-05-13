// SPDX-License-Identifier: AGPL-3.0-or-later
// Modified version of MakerDAO (https://github.com/makerdao/dss/blob/master/src/dog.sol)
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/LiquidatorLike.sol";
import "./interfaces/JailLike.sol";
import "./interfaces/LedgerLike.sol";

// --- liquidator.sol --- Liquidation Module
contract Liquidator is LiquidatorLike, Initializable {
    // --- Auth ---
    mapping (address => uint256) public wards;
    function rely(address usr) external auth { wards[usr] = 1; emit Rely(usr); }
    function deny(address usr) external auth { wards[usr] = 0; emit Deny(usr); }
    modifier auth {
        require(wards[msg.sender] == 1, "Liquidator/not-authorized");
        _;
    }

    // --- Data ---
    struct Ilk {
        address jail;  // Custodian
        uint256 chop;  // Liquidation Penalty                                                 [wad]
        uint256 hole;  // Max STABLECOIN needed to cover debt+fees of active auctions per ilk [rad]
        uint256 dirt;  // Amt STABLECOIN needed to cover debt+fees of active auctions per ilk [rad]
    }

    LedgerLike public ledger;  // CDP Engine

    mapping (bytes32 => Ilk) public ilks;

    address public settlement;   // Debt Engine

    uint256 public live;  // Active Flag
    uint256 public Hole;  // Max STABLECOIN needed to cover debt+fees of active auctions [rad]
    uint256 public Dirt;  // Amt STABLECOIN needed to cover debt+fees of active auctions [rad]

    // --- Events ---
    event Rely(address indexed usr);
    event Deny(address indexed usr);

    event File(bytes32 indexed what, uint256 data);
    event File(bytes32 indexed what, address data);
    event File(bytes32 indexed ilk, bytes32 indexed what, uint256 data);
    event File(bytes32 indexed ilk, bytes32 indexed what, address jail);

    event Bark(
      bytes32 indexed ilk,
      address indexed urn,
      uint256 ink,
      uint256 art,
      uint256 due,
      address jail,
      uint256 indexed id
    );
    event Digs(bytes32 indexed ilk, uint256 rad);
    event Cage();
    event Uncage();
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function initialize(address ledger_) external initializer {
        ledger = LedgerLike(ledger_);
        live = 1;
        wards[msg.sender] = 1;
        emit Rely(msg.sender);
    }

    // --- Math ---
    uint256 constant WAD = 10 ** 18;

    function min(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x <= y ? x : y;
    }
    function add(uint256 x, uint256 y) internal pure returns (uint256 z) {
        unchecked {
            require((z = x + y) >= x);
        }
    }
    function sub(uint256 x, uint256 y) internal pure returns (uint256 z) {
        unchecked {
            require((z = x - y) <= x);
        }
    }
    function mul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        unchecked {
            require(y == 0 || (z = x * y) / y == x);
        }
    }

    // --- Administration ---
    function file(bytes32 what, address data) external auth {
        if (what == "settlement") settlement = data;
        else revert("Liquidator/file-unrecognized-param");
        emit File(what, data);
    }
    function file(bytes32 what, uint256 data) external auth {
        if (what == "Hole") Hole = data;
        else revert("Liquidator/file-unrecognized-param");
        emit File(what, data);
    }
    function file(bytes32 ilk, bytes32 what, uint256 data) external auth {
        if (what == "chop") {
            require(data >= WAD, "Liquidator/file-chop-lt-WAD");
            ilks[ilk].chop = data;
        } else if (what == "hole") ilks[ilk].hole = data;
        else revert("Liquidator/file-unrecognized-param");
        emit File(ilk, what, data);
    }
    function file(bytes32 ilk, bytes32 what, address jail) external auth {
        if (what == "jail") {
            require(ilk == JailLike(jail).ilk(), "Liquidator/file-ilk-neq-jail.ilk");
            ilks[ilk].jail = jail;
        } else revert("Liquidator/file-unrecognized-param");
        emit File(ilk, what, jail);
    }

    function chop(bytes32 ilk) external view returns (uint256) {
        return ilks[ilk].chop;
    }

    // --- CDP Liquidation: all bark and no bite ---
    //
    // Liquidate a Vault and start a Dutch auction to sell its collateral for STABLECOIN.
    //
    // The third argument is the address that will receive the liquidation reward, if any.
    //
    // The entire Vault will be liquidated except when the target amount of STABLECOIN to be raised in
    // the resulting auction (debt of Vault + liquidation penalty) causes either Dirt to exceed
    // Hole or ilk.dirt to exceed ilk.hole by an economically significant amount. In that
    // case, a partial liquidation is performed to respect the global and per-ilk limits on
    // outstanding STABLECOIN target. The one exception is if the resulting auction would likely
    // have too little collateral to be interesting to Keepers (debt taken from Vault < ilk.dust),
    // in which case the function reverts. Please refer to the code and comments within if
    // more detail is desired.
    function bark(bytes32 ilk, address urn, address kpr) external auth returns (uint256 id) {
        require(live == 1, "Liquidator/not-live");

        (uint256 ink, uint256 art) = ledger.urns(ilk, urn);
        Ilk memory milk = ilks[ilk];
        uint256 dart;
        uint256 rate;
        uint256 dust;
        {
            uint256 vision;
            (,rate, vision,, dust) = ledger.ilks(ilk);
            require(vision > 0 && mul(ink, vision) < mul(art, rate), "Liquidator/not-unsafe");

            // Get the minimum value between:
            // 1) Remaining space in the general Hole
            // 2) Remaining space in the collateral hole
            require(Hole > Dirt && milk.hole > milk.dirt, "Liquidator/liquidation-limit-hit");
            uint256 room = min(Hole - Dirt, milk.hole - milk.dirt);

            // uint256.max()/(RAD*WAD) = 115,792,089,237,316
            dart = min(art, mul(room, WAD) / rate / milk.chop);

            // Partial liquidation edge case logic
            if (art > dart) {
                if (mul(art - dart, rate) < dust) {

                    // If the leftover Vault would be dusty, just liquidate it entirely.
                    // This will result in at least one of dirt_i > hole_i or Dirt > Hole becoming true.
                    // The amount of excess will be bounded above by ceiling(dust_i * chop_i / WAD).
                    // This deviation is assumed to be small compared to both hole_i and Hole, so that
                    // the extra amount of target STABLECOIN over the limits intended is not of economic concern.
                    dart = art;
                } else {

                    // In a partial liquidation, the resulting auction should also be non-dusty.
                    require(mul(dart, rate) >= dust, "Liquidator/dusty-auction-from-partial-liquidation");
                }
            }
        }

        uint256 dink = mul(ink, dart) / art;

        require(dink > 0, "Liquidator/null-auction");
        require(dart <= 2**255 && dink <= 2**255, "Liquidator/overflow");

        ledger.grab(
            ilk, urn, milk.jail, settlement, -int256(dink), -int256(dart)
        );

        uint256 due = mul(dart, rate);

        {   // Avoid stack too deep
            // This calcuation will overflow if dart*rate exceeds ~10^14
            uint256 tab = mul(due, milk.chop) / WAD;
            Dirt = add(Dirt, tab);
            ilks[ilk].dirt = add(milk.dirt, tab);

            id = JailLike(milk.jail).kick({
                tab: tab,
                lot: dink,
                usr: urn,
                kpr: kpr
            });
        }

        emit Bark(ilk, urn, dink, dart, due, milk.jail, id);
    }

    function digs(bytes32 ilk, uint256 rad) external auth {
        Dirt = sub(Dirt, rad);
        ilks[ilk].dirt = sub(ilks[ilk].dirt, rad);
        emit Digs(ilk, rad);
    }

    function cage() external auth {
        live = 0;
        emit Cage();
    }

    function uncage() external auth {
        live = 1;
        emit Uncage();
    }
}