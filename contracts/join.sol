// SPDX-License-Identifier: AGPL-3.0-or-later
// Modified version of MakerDAO (https://github.com/makerdao/dss/blob/master/src/join.sol)
pragma solidity ^0.8.10;

import "./interfaces/GemJoinLike.sol";
import "./interfaces/StablecoinJoinLike.sol";
import "./interfaces/GemLike.sol";
import "./interfaces/LedgerLike.sol";
import "./interfaces/IStablecoin.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/*
    Here we provide *adapters* to connect the Ledger to arbitrary external
    token implementations, creating a bounded context for the Ledger. The
    adapters here are provided as working examples:
      - `GemJoin`: For well behaved ERC20 tokens, with simple transfer
                   semantics.
      - `ETHJoin`: For native Ether.
      - `StablecoinJoin`: For connecting internal Stablecoin balances to an external
                   `DSToken` implementation.
    In practice, adapter implementations will be varied and specific to
    individual collateral types, accounting for different transfer
    semantics and token standards.
    Adapters need to implement two basic methods:
      - `join`: enter collateral into the system
      - `exit`: remove collateral from the system
*/

// --- join.sol --- Token adapters
contract GemJoin is Initializable, GemJoinLike {

    // --- Auth ---
    mapping (address => uint) public wards;
    function rely(address usr) external auth {
        wards[usr] = 1;
        emit Rely(usr);
    }
    function deny(address usr) external auth {
        wards[usr] = 0;
        emit Deny(usr);
    }
    modifier auth {
        require(wards[msg.sender] == 1, "GemJoin/not-authorized");
        _;
    }

    LedgerLike public ledger;  // CDP Engine
    bytes32 public ilk;        // Collateral Type
    GemLike public gem;
    uint    public dec;
    uint    public live;       // Active Flag

    // Events
    event Rely(address indexed usr);
    event Deny(address indexed usr);
    event Join(address indexed usr, uint256 wad);
    event Exit(address indexed usr, uint256 wad);
    event Cage();
    event UnCage();
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function initialize(address ledger_, bytes32 ilk_, address gem_) external initializer {
        wards[msg.sender] = 1;
        live = 1;
        ledger = LedgerLike(ledger_);
        ilk = ilk_;
        gem = GemLike(gem_);
        dec = gem.decimals();
        emit Rely(msg.sender);
    }
    function cage() external auth {
        live = 0;
        emit Cage();
    }

    function uncage() external auth {
        live = 1;
        emit UnCage();
    }

    function join(address usr, uint wad) external auth {
        require(live == 1, "GemJoin/not-live");
        require(int(wad) >= 0, "GemJoin/overflow");
        ledger.slip(ilk, usr, int(wad));
        require(gem.transferFrom(msg.sender, address(this), wad), "GemJoin/failed-transfer");
        emit Join(usr, wad);
    }
    function exit(address usr, uint wad) external auth {
        require(wad <= (2 ** 255) - 1, "GemJoin/overflow");
        ledger.slip(ilk, msg.sender, -int(wad));
        require(gem.transfer(usr, wad), "GemJoin/failed-transfer");
        emit Exit(usr, wad);
    }
}

contract StablecoinJoin is Initializable, StablecoinJoinLike {

    // --- Auth ---
    mapping (address => uint) public wards;
    function rely(address usr) external auth {
        wards[usr] = 1;
        emit Rely(usr);
    }
    function deny(address usr) external auth {
        wards[usr] = 0;
        emit Deny(usr);
    }
    modifier auth {
        require(wards[msg.sender] == 1, "StablecoinJoin/not-authorized");
        _;
    }

    LedgerLike public ledger;       // CDP Engine
    IStablecoin public stablecoin;  // Stablecoin Token
    uint    public live;            // Active Flag

    // Events
    event Rely(address indexed usr);
    event Deny(address indexed usr);
    event Join(address indexed usr, uint256 wad);
    event Exit(address indexed usr, uint256 wad);
    event Cage();
    event Uncage();

    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }
    
    // --- Init ---
    function initialize(address ledger_, address stablecoin_) external initializer {
        wards[msg.sender] = 1;
        live = 1;
        ledger = LedgerLike(ledger_);
        stablecoin = IStablecoin(stablecoin_);
    }
    function cage() external auth {
        live = 0;
        emit Cage();
    }
    function uncage() external auth {
        live = 1;
        emit Uncage();
    }
    uint constant ONE = 10 ** 27;
    function mul(uint x, uint y) internal pure returns (uint z) {
        unchecked {
            require(y == 0 || (z = x * y) / y == x);
        }
    }
    function join(address usr, uint wad) external auth {
        ledger.move(address(this), usr, mul(ONE, wad));
        stablecoin.burn(msg.sender, wad);
        emit Join(usr, wad);
    }
    function exit(address usr, uint wad) external auth {
        require(live == 1, "StablecoinJoin/not-live");
        ledger.move(msg.sender, address(this), mul(ONE, wad));
        stablecoin.mint(usr, wad);
        emit Exit(usr, wad);
    }
}