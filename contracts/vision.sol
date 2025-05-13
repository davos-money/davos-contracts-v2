// SPDX-License-Identifier: AGPL-3.0-or-later
// Modified version of MakerDAO (https://github.com/makerdao/dss/blob/master/src/spot.sol)
pragma solidity ^0.8.10;

import "./interfaces/VisionLike.sol";
import "./interfaces/LedgerLike.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// --- vision.sol --- Oracle Registry
contract Vision is Initializable, VisionLike {
    
    // --- Auth ---
    mapping (address => uint) public wards;
    function rely(address guy) external auth { wards[guy] = 1; }
    function deny(address guy) external auth { wards[guy] = 0; }
    modifier auth {
        require(wards[msg.sender] == 1, "Vision/not-authorized");
        _;
    }

    // --- Data ---
    struct Ilk {
        PipLike pip;  // Price Feed
        uint256 mat;  // Liquidation ratio [ray]
    }

    mapping (bytes32 => Ilk) public ilks;

    LedgerLike public ledger;  // CDP Engine
    uint256 public par;        // ref per stablecoin [ray]

    uint256 public live;

    // --- Events ---
    event Poke(
      bytes32 ilk,
      bytes32 val,  // [wad]
      uint256 vision  // [ray]
    );

    event File(bytes32 indexed what, uint256 data);
    event File(bytes32 indexed ilk, bytes32 indexed what, uint256 data);
    event File(bytes32 indexed ilk, bytes32 indexed what, address jail);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function initialize(address ledger_) external initializer {
        wards[msg.sender] = 1;
        ledger = LedgerLike(ledger_);
        par = ONE;
        live = 1;
    }

    // --- Math ---
    uint constant ONE = 10 ** 27;

    function mul(uint x, uint y) internal pure returns (uint z) {
        unchecked {
            require(y == 0 || (z = x * y) / y == x);
        }
    }

    function rdiv(uint x, uint y) internal pure returns (uint z) {
        unchecked {
            z = mul(x, ONE) / y;
        }
    }

    // --- Administration ---
    function file(bytes32 ilk, bytes32 what, address pip_) external auth {
        require(live == 1, "Vision/not-live");
        if (what == "pip") ilks[ilk].pip = PipLike(pip_);
        else revert("Vision/file-unrecognized-param");
        emit File(ilk, what, pip_);
    }
    function file(bytes32 what, uint data) external auth {
        require(live == 1, "Vision/not-live");
        if (what == "par") par = data;
        else revert("Vision/file-unrecognized-param");
        emit File(what, data);
    }
    function file(bytes32 ilk, bytes32 what, uint data) external auth {
        require(live == 1, "Vision/not-live");
        if (what == "mat") ilks[ilk].mat = data;
        else revert("Vision/file-unrecognized-param");
        emit File(ilk, what, data);
    }

    // --- Update value ---
    function poke(bytes32 ilk) external {
        (bytes32 val, bool has) = ilks[ilk].pip.peek();
        uint256 vision = has ? rdiv(rdiv(mul(uint(val), 10 ** 9), par), ilks[ilk].mat) : 0;
        ledger.file(ilk, "vision", vision);
        emit Poke(ilk, val, vision);
    }

    function cage() external auth {
        live = 0;
    }

    function uncage() external auth {
        live = 1;
    }
}
