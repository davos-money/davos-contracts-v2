// SPDX-License-Identifier: AGPL-3.0-or-later
// Modified version of MakerDAO (https://github.com/makerdao/dss/blob/master/src/pot.sol)
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface LedgerLike {
    function move(address,address,uint256) external;
    function suck(address,address,uint256) external;
}

// --- savings.sol --- Savings Rate
contract Savings is Initializable {
    // --- Auth ---
    mapping (address => uint) public wards;
    function rely(address guy) external auth { wards[guy] = 1; }
    function deny(address guy) external auth { wards[guy] = 0; }
    modifier auth {
        require(wards[msg.sender] == 1, "Savings/not-authorized");
        _;
    }

    // --- Data ---
    mapping (address => uint256) public pie;  // Normalised Savings STABLECOIN [wad]

    uint256 public Pie;   // Total Normalised Savings STABLECOIN  [wad]
    uint256 public dsr;   // The STABLECOIN Savings Rate          [ray]
    uint256 public chi;   // The Rate Accumulator                 [ray]

    LedgerLike public ledger;   // CDP Engine
    address public settlement;  // Debt Engine
    uint256 public rho;         // Time of last drip     [unix epoch time]

    uint256 public live;  // Active Flag

    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function initialize(address ledger_) external initializer {
        wards[msg.sender] = 1;
        ledger = LedgerLike(ledger_);
        dsr = ONE;
        chi = ONE;
        rho = block.timestamp;
        live = 1;
    }

    // --- Math ---
    uint256 constant ONE = 10 ** 27;
    function _rpow(uint x, uint n, uint base) internal pure returns (uint z) {
        assembly {
            switch x case 0 {switch n case 0 {z := base} default {z := 0}}
            default {
                switch mod(n, 2) case 0 { z := base } default { z := x }
                let half := div(base, 2)  // for rounding.
                for { n := div(n, 2) } n { n := div(n,2) } {
                    let xx := mul(x, x)
                    if iszero(eq(div(xx, x), x)) { revert(0,0) }
                    let xxRound := add(xx, half)
                    if lt(xxRound, xx) { revert(0,0) }
                    x := div(xxRound, base)
                    if mod(n,2) {
                        let zx := mul(z, x)
                        if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) { revert(0,0) }
                        let zxRound := add(zx, half)
                        if lt(zxRound, zx) { revert(0,0) }
                        z := div(zxRound, base)
                    }
                }
            }
        }
    }

    function _rmul(uint x, uint y) internal pure returns (uint z) {
        z = (x * y) / ONE;
    }

    // --- Administration ---
    function file(bytes32 what, uint256 data) external auth {
        require(live == 1, "Savings/not-live");
        if (block.timestamp > rho) drip();
        if (what == "dsr") dsr = data;
        else revert("Savings/file-unrecognized-param");
    }

    function file(bytes32 what, address addr) external auth {
        if (what == "settlement") settlement = addr;
        else revert("Savings/file-unrecognized-param");
    }

    function cage() external auth {
        live = 0;
        dsr = ONE;
    }

    // --- Savings Rate Accumulation ---
    function drip() public returns (uint tmp) {
        require(block.timestamp >= rho, "Savings/invalid-now");
        tmp = _rmul(_rpow(dsr, block.timestamp - rho, ONE), chi);
        uint chi_ = tmp - chi;
        chi = tmp;
        rho = block.timestamp;
        ledger.suck(address(settlement), address(this), Pie * chi_);
    }

    // --- Savings STABLECOIN Management ---
    function join(uint wad) external {
        require(block.timestamp == rho, "Savings/rho-not-updated");
        pie[msg.sender] += wad;
        Pie             += wad;
        ledger.move(msg.sender, address(this), chi * wad);
    }

    function exit(uint wad) external {
        pie[msg.sender] -= wad;
        Pie             -= wad;
        ledger.move(address(this), msg.sender, chi * wad);
    }
}