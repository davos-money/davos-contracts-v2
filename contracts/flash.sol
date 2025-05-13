// SPDX-License-Identifier: AGPL-3.0-or-later
// Modified version of MakerDAO (https://github.com/makerdao/dss-flash/blob/master/src/flash.sol)
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "./interfaces/StablecoinJoinLike.sol";
import "./interfaces/LedgerLike.sol";
import "./interfaces/IStablecoin.sol";
import "./interfaces/IERC3156FlashLender.sol";
import "./interfaces/IERC3156FlashBorrower.sol";

contract Flash is Initializable, ReentrancyGuardUpgradeable, IERC3156FlashLender {

    // --- Auth ---
    function rely(address usr) external auth { wards[usr] = 1; emit Rely(usr); }
    function deny(address usr) external auth { wards[usr] = 0; emit Deny(usr); }
    mapping (address => uint256) public wards;
    modifier auth { require(wards[msg.sender] == 1, "Flash/not-authorized"); _; }

    // --- Data ---
    LedgerLike         public ledger;
    StablecoinJoinLike public stablecoinJoin;
    IStablecoin        public stablecoin;
    address            public settlement;

    uint256     public  max;     // Maximum borrowable stablecoin [wad]
    uint256     public  toll;    // Fee to be returned            [wad = 100%]

    uint256 private constant WAD = 10 ** 18;
    uint256 private constant RAY = 10 ** 27;
    uint256 private constant RAD = 10 ** 45;

    bytes32 public constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

    // --- Events ---
    event Rely(address indexed usr);
    event Deny(address indexed usr);
    event File(bytes32 indexed what, uint256 data);
    event FlashLoan(address indexed receiver, address token, uint256 amount, uint256 fee);

    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }
    
    // --- Init ---
    function initialize(address _ledger, address _stablecoin, address _stablecoinJoin, address _settlement) external initializer {
        
        __ReentrancyGuard_init();

        wards[msg.sender] = 1;
        ledger = LedgerLike(_ledger);
        stablecoinJoin = StablecoinJoinLike(_stablecoinJoin);
        stablecoin = IStablecoin(_stablecoin);
        settlement = _settlement;

        ledger.hope(_stablecoinJoin);
        stablecoin.approve(_stablecoinJoin, type(uint256).max);
        emit Rely(msg.sender);
    }

    // --- Administration ---
    function file(bytes32 what, uint256 data) external auth {
        if (what == "max") {
            // Add an upper limit of 10^27 STABLECOIN to avoid breaking technical assumptions of STABLECOIN << 2^256 - 1
            require((max = data) <= RAD, "Flash/ceiling-too-high");
        } else if (what == "toll") toll = data;
        else revert("Flash/file-unrecognized-param");
        emit File(what, data);
    }

    // --- ERC 3156 Spec ---
    function maxFlashLoan(address token) external override view returns (uint256) {
        if (token == address(stablecoin)) {
            return max;
        } else {
            return 0;
        }
    }

    function flashFee(address token, uint256 amount) external override view returns (uint256) {
        require(token == address(stablecoin), "Flash/token-unsupported");
        return (amount * toll) / WAD;
    }

    function flashLoan(IERC3156FlashBorrower receiver, address token, uint256 amount, bytes calldata data) external override nonReentrant returns (bool) {
        require(token == address(stablecoin), "Flash/token-unsupported");
        require(amount <= max, "Flash/ceiling-exceeded");
        require(ledger.live() == 1, "Flash/ledger-not-live");

        uint256 amt = amount * RAY;
        uint256 fee = (amount * toll) / WAD;
        uint256 total = amount + fee;

        ledger.suck(address(this), address(this), amt);
        stablecoinJoin.exit(address(receiver), amount);

        emit FlashLoan(address(receiver), token, amount, fee);

        require(receiver.onFlashLoan(msg.sender, token, amount, fee, data) == CALLBACK_SUCCESS, "Flash/callback-failed");

        stablecoin.transferFrom(address(receiver), address(this), total);
        stablecoinJoin.join(address(this), total);
        ledger.heal(amt);

        return true;
    }

    function accrue() external nonReentrant {
        ledger.move(address(this), settlement, ledger.stablecoin(address(this)));
    }
}