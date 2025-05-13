// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./dMath.sol";
import "./oracle/libraries/FullMath.sol";

import "./interfaces/LedgerLike.sol";
import "./interfaces/StablecoinJoinLike.sol";
import "./interfaces/GemJoinLike.sol";
import "./interfaces/FeeLike.sol";
import "./interfaces/LiquidatorLike.sol";
import "./interfaces/PipLike.sol";
import "./interfaces/VisionLike.sol";
import "./provider/interfaces/IProvider.sol";
import "./interfaces/IInteraction.sol";

import "./libraries/AuctionProxy.sol";


uint256 constant WAD = 10 ** 18;
uint256 constant RAD = 10 ** 45;
uint256 constant YEAR = 31556952; //seconds in year (365.2425 * 24 * 3600)

contract Interaction is Initializable, IInteraction {

    mapping(address => uint) public wards;

    function rely(address usr) external auth {wards[usr] = 1;}

    function deny(address usr) external auth {wards[usr] = 0;}
    modifier auth {
        require(wards[msg.sender] == 1, "Interaction/not-authorized");
        _;
    }

    LedgerLike public ledger;
    VisionLike public vision;
    IERC20 public stablecoin;
    StablecoinJoinLike public stablecoinJoin;
    FeeLike public fee;
    address public liquidator;

    mapping(address => uint256) public deposits;
    mapping(address => CollateralType) public collaterals;

    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    mapping(address => address) public providers;

    uint256 public whitelistMode;
    address public whitelistOperator;
    mapping(address => uint) public whitelist;
    function enableWhitelist() external auth {whitelistMode = 1;}
    function disableWhitelist() external auth {whitelistMode = 0;}
    function setWhitelistOperator(address usr) external auth {
        whitelistOperator = usr;
    }
    function addToWhitelist(address[] memory usrs) external operatorOrWard {
        for(uint256 i = 0; i < usrs.length; i++) {
            whitelist[usrs[i]] = 1;
            emit AddedToWhitelist(usrs[i]);
        }
    }
    function removeFromWhitelist(address[] memory usrs) external operatorOrWard {
        for(uint256 i = 0; i < usrs.length; i++) {
            whitelist[usrs[i]] = 0;
            emit RemovedFromWhitelist(usrs[i]);
        }
    }
    modifier whitelisted(address participant) {
        if (whitelistMode == 1)
            require(whitelist[participant] == 1, "Interaction/not-in-whitelist");
        _;
    }
    modifier operatorOrWard {
        require(msg.sender == whitelistOperator || wards[msg.sender] == 1, "Interaction/not-operator-or-ward"); 
        _;
    }
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    function initialize(
        address ledger_,
        address vision_,
        address stablecoin_,
        address stablecoinJoin_,
        address fee_,
        address liquidator_
    ) external initializer {

        wards[msg.sender] = 1;

        ledger = LedgerLike(ledger_);
        vision = VisionLike(vision_);
        stablecoin = IERC20(stablecoin_);
        stablecoinJoin = StablecoinJoinLike(stablecoinJoin_);
        fee = FeeLike(fee_);
        liquidator = liquidator_;

        ledger.hope(stablecoinJoin_);

        stablecoin.approve(stablecoinJoin_, type(uint256).max);
    }

    function setCores(address ledger_, address vision_, address stablecoinJoin_,
        address fee_) public auth {
        // Reset previous approval
        stablecoin.approve(address(stablecoinJoin), 0);

        ledger = LedgerLike(ledger_);
        vision = VisionLike(vision_);
        stablecoinJoin = StablecoinJoinLike(stablecoinJoin_);
        fee = FeeLike(fee_);

        ledger.hope(stablecoinJoin_);

        stablecoin.approve(stablecoinJoin_, type(uint256).max);
    }

    function setStablecoinApprove() public auth {
        stablecoin.approve(address(stablecoinJoin), type(uint256).max);
    }

    function setCollateralType(
        address token,
        address gemJoin,
        bytes32 ilk,
        address jail,
        uint256 mat
    ) external auth {
        require(collaterals[token].live == 0, "Interaction/token-already-init");
        require(ilk != bytes32(0), "Interaction/empty-ilk");
        ledger.init(ilk);
        fee.init(ilk);
        vision.file(ilk, "mat", mat);
        collaterals[token] = CollateralType(GemJoinLike(gemJoin), ilk, 1, jail);
        IERC20(token).approve(gemJoin, type(uint256).max);
        ledger.rely(gemJoin);
        emit CollateralEnabled(token, ilk);
    }

    function setCollateralDuty(address token, uint data) external auth {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);
        fee.drip(collateralType.ilk);
        fee.file(collateralType.ilk, "duty", data);
    }

    function setProvider(address token, address Provider) external auth {
        require(Provider != address(0));
        providers[token] = Provider;
        emit ChangeProvider(Provider);
    }

    function removeCollateralType(address token) external auth {
        require(collaterals[token].live != 0, "Interaction/token-not-init");
        collaterals[token].live = 2; //STOPPED
        address gemJoin = address(collaterals[token].gem);
        ledger.deny(gemJoin);
        IERC20(token).approve(gemJoin, 0);
        emit CollateralDisabled(token, collaterals[token].ilk);
    }

    function reenableCollateralType(address token) external auth {
        collaterals[token].live = 1;
        address gemJoin = address(collaterals[token].gem);
        ledger.rely(gemJoin);
        IERC20(token).approve(gemJoin, type(uint256).max);
        emit CollateralEnabled(token, collaterals[token].ilk);
    }

    function stringToBytes32(string memory source) external pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(source, 32))
        }
    }

    function deposit(
        address participant,
        address token,
        uint256 dink
    ) external whitelisted(participant) returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        require(collateralType.live == 1, "Interaction/inactive-collateral");

        if (providers[token] != address(0)) {
            require(
                msg.sender == providers[token],
                "Interaction/only stablecoin provider can deposit for this token"
            );
        }
        require(dink <= uint256(type(int256).max), "Interaction/too-much-requested");
        drip(token);
        uint256 preBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), dink);
        uint256 postBalance = IERC20(token).balanceOf(address(this));
        require(preBalance + dink == postBalance, "Interaction/deposit-deflated");

        collateralType.gem.join(participant, dink);
        ledger.behalf(participant, address(this));
        ledger.frob(collateralType.ilk, participant, participant, participant, int256(dink), 0);

        deposits[token] += dink;

        emit Deposit(participant, token, dink, locked(token, participant));
        return dink;
    }

    function borrow(address token, uint256 stablecoinAmount) external returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        require(collateralType.live == 1, "Interaction/inactive-collateral");
        require(stablecoinAmount > 0,"Interaction/invalid-stablecoinAmount");

        drip(token);

        (, uint256 rate, , ,) = ledger.ilks(collateralType.ilk);
        int256 dart = int256(stablecoinAmount * RAY / rate);
        require(dart >= 0, "Interaction/too-much-requested");
        if (uint256(dart) * rate < stablecoinAmount * RAY) {
            dart += 1; //ceiling
        }
        ledger.frob(collateralType.ilk, msg.sender, msg.sender, msg.sender, 0, dart);
        ledger.move(msg.sender, address(this), stablecoinAmount * RAY);
        stablecoinJoin.exit(msg.sender, stablecoinAmount);

        (uint256 ink, uint256 art) = ledger.urns(collateralType.ilk, msg.sender);
        uint256 liqPrice = liquidationPriceForDebt(collateralType.ilk, ink, art);
        emit Borrow(msg.sender, token, ink, stablecoinAmount, liqPrice);
        return uint256(dart);
    }

    // Burn user's STABLECOIN.
    // N.B. User collateral stays the same.
    function payback(address token, uint256 stablecoinAmount) external returns (int256) {
        require(stablecoinAmount > 0,"Interaction/invalid-stablecoinAmount");
        CollateralType memory collateralType = collaterals[token];
        // _checkIsLive(collateralType.live); Checking in the `drip` function

        (,uint256 rate,,,) = ledger.ilks(collateralType.ilk);
        (,uint256 art) = ledger.urns(collateralType.ilk, msg.sender);
        int256 dart;
        uint256 realAmount = stablecoinAmount;
        uint256 debt = rate * art;
        if (realAmount * RAY >= debt) { // Close CDP
            dart = int(art);
            realAmount = debt / RAY;
            realAmount = realAmount * RAY == debt ? realAmount : realAmount + 1;
        } else { // Less/Greater than dust
            dart = int256(FullMath.mulDiv(realAmount, RAY, rate));
        }

        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), realAmount);
        stablecoinJoin.join(msg.sender, realAmount);

        require(dart >= 0, "Interaction/too-much-requested");

        ledger.frob(collateralType.ilk, msg.sender, msg.sender, msg.sender, 0, - dart);

        drip(token);

        (uint256 ink, uint256 userDebt) = ledger.urns(collateralType.ilk, msg.sender);
        uint256 liqPrice = liquidationPriceForDebt(collateralType.ilk, ink, userDebt);
        emit Payback(msg.sender, token, realAmount, userDebt, liqPrice);
        return dart;
    }

    // Unlock and transfer to the user `dink` amount of collateral
    function withdraw(
        address participant,
        address token,
        uint256 dink
    ) external returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);
        if (providers[token] != address(0)) {
            require(
                msg.sender == providers[token],
                "Interaction/Only stablecoin provider can call this function for this token"
            );
        } else {
            require(
                msg.sender == participant,
                "Interaction/Caller must be the same address as participant"
            );
        }

        uint256 unlocked = free(token, participant);
        if (unlocked < dink) {
            int256 diff = int256(dink) - int256(unlocked);
            ledger.frob(collateralType.ilk, participant, participant, participant, - diff, 0);
            ledger.flux(collateralType.ilk, participant, address(this), uint256(diff));
        }
        // Collateral is actually transferred back to user inside `exit` operation.
        // See GemJoin.exit()
        collateralType.gem.exit(msg.sender, dink);
        deposits[token] -= dink;

        emit Withdraw(participant, dink);
        return dink;
    }

    function drip(address token) public {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        fee.drip(collateralType.ilk);
    }

    function poke(address token) public {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        vision.poke(collateralType.ilk);
    }

    //    /////////////////////////////////
    //    //// VIEW                    ////
    //    /////////////////////////////////

    // Price of the collateral asset from Oracle
    function collateralPrice(address token) public view returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        (PipLike pip,) = vision.ilks(collateralType.ilk);
        (bytes32 price, bool has) = pip.peek();
        if (has) {
            return uint256(price);
        } else {
            return 0;
        }
    }

    // Returns the STABLECOIN price in $
    function stablecoinPrice(address token) external view returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        (, uint256 rate,,,) = ledger.ilks(collateralType.ilk);
        return rate / 10 ** 9;
    }

    // Returns the collateral ratio in percents with 18 decimals
    function collateralRate(address token) external view returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        (,uint256 mat) = vision.ilks(collateralType.ilk);
        require(mat != 0, "Interaction/vision-not-init");
        return 10 ** 45 / mat;
    }

    // Total collateral deposited nominated in $
    function depositTVL(address token) external view returns (uint256) {
        return deposits[token] * collateralPrice(token) / WAD;
    }

    // Total STABLECOIN borrowed by all users
    function collateralTVL(address token) external view returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        (uint256 Art, uint256 rate,,,) = ledger.ilks(collateralType.ilk);
        return FullMath.mulDiv(Art, rate, RAY);
    }

    // Not locked user balance in collateral
    function free(address token, address usr) public view returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        return ledger.gem(collateralType.ilk, usr);
    }

    // User collateral in collateral
    function locked(address token, address usr) public view returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        (uint256 ink,) = ledger.urns(collateralType.ilk, usr);
        return ink;
    }

    // Total borrowed STABLECOIN
    function borrowed(address token, address usr) external view returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        (,uint256 rate,,,) = ledger.ilks(collateralType.ilk);
        (, uint256 art) = ledger.urns(collateralType.ilk, usr);
        
        // 100 Wei is added as a ceiling to help close CDP in repay()
        if ((art * rate) / RAY != 0) {
            return ((art * rate) / RAY) + 100;
        }
        else {
            return 0;
        }
    }

    // Collateral minus borrowed. Basically free collateral (nominated in STABLECOIN)
    function availableToBorrow(address token, address usr) external view returns (int256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        (uint256 ink, uint256 art) = ledger.urns(collateralType.ilk, usr);
        (, uint256 rate, uint256 vision,,) = ledger.ilks(collateralType.ilk);
        uint256 collateral = ink * vision;
        uint256 debt = rate * art;
        return (int256(collateral) - int256(debt)) / 1e27;
    }

    // Collateral + `amount` minus borrowed. Basically free collateral (nominated in STABLECOIN)
    // Returns how much stablecoin you can borrow if provide additional `amount` of collateral
    function willBorrow(address token, address usr, int256 amount) external view returns (int256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        (uint256 ink, uint256 art) = ledger.urns(collateralType.ilk, usr);
        (, uint256 rate, uint256 vision,,) = ledger.ilks(collateralType.ilk);
        require(amount >= - (int256(ink)), "Cannot withdraw more than current amount");
        if (amount < 0) {
            ink = uint256(int256(ink) + amount);
        } else {
            ink += uint256(amount);
        }
        uint256 collateral = ink * vision;
        uint256 debt = rate * art;
        return (int256(collateral) - int256(debt)) / 1e27;
    }

    function liquidationPriceForDebt(bytes32 ilk, uint256 ink, uint256 art) internal view returns (uint256) {
        if (ink == 0) {
            return 0; // no meaningful price if user has no debt
        }
        (, uint256 rate,,,) = ledger.ilks(ilk);
        (,uint256 mat) = vision.ilks(ilk);
        uint256 backedDebt = (art * rate / 10 ** 36) * mat;
        return backedDebt / ink;
    }

    // Price of collateral when user will be liquidated
    function currentLiquidationPrice(address token, address usr) external view returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        (uint256 ink, uint256 art) = ledger.urns(collateralType.ilk, usr);
        return liquidationPriceForDebt(collateralType.ilk, ink, art);
    }

    // Price of collateral when user will be liquidated with additional amount of collateral deposited/withdraw
    function estimatedLiquidationPrice(address token, address usr, int256 amount) external view returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        (uint256 ink, uint256 art) = ledger.urns(collateralType.ilk, usr);
        require(amount >= - (int256(ink)), "Cannot withdraw more than current amount");
        if (amount < 0) {
            ink = uint256(int256(ink) + amount);
        } else {
            ink += uint256(amount);
        }
        return liquidationPriceForDebt(collateralType.ilk, ink, art);
    }

    // Price of collateral when user will be liquidated with additional amount of STABLECOIN borrowed/payback
    //positive amount mean STABLECOINs are being borrowed. So art(debt) will increase
    function estimatedLiquidationPriceSTABLECOIN(address token, address usr, int256 amount) external view returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        (uint256 ink, uint256 art) = ledger.urns(collateralType.ilk, usr);
        require(amount >= - (int256(art)), "Cannot withdraw more than current amount");
        (, uint256 rate,,,) = ledger.ilks(collateralType.ilk);
        (,uint256 mat) = vision.ilks(collateralType.ilk);
        uint256 backedDebt = FullMath.mulDiv(art, rate, 10 ** 36);
        if (amount < 0) {
            backedDebt = uint256(int256(backedDebt) + amount);
        } else {
            backedDebt += uint256(amount);
        }
        return FullMath.mulDiv(backedDebt, mat, ink) / 10 ** 9;
    }

    // Returns borrow APR with 20 decimals.
    // I.e. 10% == 10 ethers
    function borrowApr(address token) public view returns (uint256) {
        CollateralType memory collateralType = collaterals[token];
        _checkIsLive(collateralType.live);

        (uint256 duty,) = fee.ilks(collateralType.ilk);
        uint256 principal = dMath.rpow((fee.base() + duty), YEAR, RAY);
        return (principal - RAY) / (10 ** 7);
    }

    function startAuction(
        address token,
        address user,
        address keeper
    ) external returns (uint256) {
        CollateralType memory collateral = collaterals[token];
        (uint256 ink,) = ledger.urns(collateral.ilk, user);
        IProvider provider = IProvider(providers[token]);
        uint256 auctionAmount = AuctionProxy.startAuction(
            user,
            keeper,
            stablecoin,
            stablecoinJoin,
            ledger,
            LiquidatorLike(liquidator),
            provider,
            collateral
        );

        emit AuctionStarted(token, user, ink, collateralPrice(token));
        return auctionAmount;
    }

    function buyFromAuction(
        address token,
        uint256 auctionId,
        uint256 collateralAmount,
        uint256 maxPrice,
        address receiverAddress
    ) external {
        CollateralType memory collateral = collaterals[token];
        IProvider Provider = IProvider(providers[token]);
        uint256 leftover = AuctionProxy.buyFromAuction(
            auctionId,
            collateralAmount,
            maxPrice,
            receiverAddress,
            stablecoin,
            stablecoinJoin,
            ledger,
            Provider,
            collateral
        );

        address urn = JailLike(collateral.jail).sales(auctionId).usr; // Liquidated address

        emit Liquidation(urn, token, collateralAmount, leftover);
    }

    function getAuctionStatus(address token, uint256 auctionId) external view returns(bool, uint256, uint256, uint256) {
        return JailLike(collaterals[token].jail).getStatus(auctionId);
    }

    function upchostJail(address token) external {
        JailLike(collaterals[token].jail).upchost();
    }

    function getAllActiveAuctionsForToken(address token) external view returns (Sale[] memory sales) {
        return AuctionProxy.getAllActiveAuctionsForJail(JailLike(collaterals[token].jail));
    }

    function resetAuction(address token, uint256 auctionId, address keeper) external {
        AuctionProxy.resetAuction(auctionId, keeper, stablecoin, stablecoinJoin, ledger, collaterals[token]);
    }

    function totalPegLiquidity() external view returns (uint256) {
        return IERC20(stablecoin).totalSupply();
    }

    function _checkIsLive(uint256 live) internal pure {
        require(live != 0, "Interaction/inactive collateral");
    }
}