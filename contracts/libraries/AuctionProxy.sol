// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/JailLike.sol";
import "../interfaces/GemJoinLike.sol";
import "../interfaces/StablecoinJoinLike.sol";
import "../interfaces/LiquidatorLike.sol";
import "../interfaces/LedgerLike.sol";
import "../provider/interfaces/IProvider.sol";
import "../oracle/libraries/FullMath.sol";

import { CollateralType } from  "../interfaces/IInteraction.sol";

uint256 constant RAY = 10**27;

library AuctionProxy {
  using SafeERC20 for IERC20;
  using SafeERC20 for GemLike;

  function startAuction(
    address user,
    address keeper,
    IERC20 stablecoin,
    StablecoinJoinLike stablecoinJoin,
    LedgerLike ledger,
    LiquidatorLike liquidator,
    IProvider provider,
    CollateralType calldata collateral
  ) public returns (uint256 id) {
    JailLike _jail = JailLike(collateral.jail);
    _jail.upchost();
    uint256 stablecoinBal = stablecoin.balanceOf(address(this));
    id = liquidator.bark(collateral.ilk, user, address(this));

    stablecoinJoin.exit(address(this), ledger.stablecoin(address(this)) / RAY);
    stablecoinBal = stablecoin.balanceOf(address(this)) - stablecoinBal;
    stablecoin.transfer(keeper, stablecoinBal);

    // Burn any derivative token (dCOL incase of MVT collateral)
    if (address(provider) != address(0)) {
      provider.daoBurn(user, _jail.sales(id).lot);
    }
  }

  function resetAuction(
    uint auctionId,
    address keeper,
    IERC20 stablecoin,
    StablecoinJoinLike stablecoinJoin,
    LedgerLike ledger,
    CollateralType calldata collateral
  ) public {
    JailLike _jail = JailLike(collateral.jail);
    uint256 stablecoinBal = stablecoin.balanceOf(address(this));
    _jail.redo(auctionId, keeper);


    stablecoinJoin.exit(address(this), ledger.stablecoin(address(this)) / RAY);
    stablecoinBal = stablecoin.balanceOf(address(this)) - stablecoinBal;
    stablecoin.transfer(keeper, stablecoinBal);
  }

  // Returns lefover from auction
  function buyFromAuction(
    uint256 auctionId,
    uint256 collateralAmount,
    uint256 maxPrice,
    address receiverAddress,
    IERC20 stablecoin,
    StablecoinJoinLike stablecoinJoin,
    LedgerLike ledger,
    IProvider provider,
    CollateralType calldata collateral
  ) public returns (uint256 leftover) {
    // Balances before
    uint256 stablecoinBal = stablecoin.balanceOf(address(this));
    uint256 gemBal = collateral.gem.gem().balanceOf(address(this));

    uint256 stablecoinMaxAmount = FullMath.mulDiv(maxPrice, collateralAmount, RAY);

    stablecoin.transferFrom(msg.sender, address(this), stablecoinMaxAmount);
    stablecoinJoin.join(address(this), stablecoinMaxAmount);

    ledger.hope(address(collateral.jail));
    address urn = JailLike(collateral.jail).sales(auctionId).usr; // Liquidated address

    leftover = ledger.gem(collateral.ilk, urn); // userGemBalanceBefore
    JailLike(collateral.jail).take(auctionId, collateralAmount, maxPrice, address(this), "");
    leftover = ledger.gem(collateral.ilk, urn) - leftover; // leftover

    collateral.gem.exit(address(this), ledger.gem(collateral.ilk, address(this)));
    stablecoinJoin.exit(address(this), ledger.stablecoin(address(this)) / RAY);

    // Balances rest
    stablecoinBal = stablecoin.balanceOf(address(this)) - stablecoinBal;
    gemBal = collateral.gem.gem().balanceOf(address(this)) - gemBal;
    stablecoin.transfer(receiverAddress, stablecoinBal);

    ledger.nope(address(collateral.jail));

    if (address(provider) != address(0)) {
      IERC20(collateral.gem.gem()).safeTransfer(address(provider), gemBal);
      provider.liquidation(receiverAddress, gemBal);

      if (leftover != 0) {
        // Auction ended with leftover
        ledger.flux(collateral.ilk, urn, address(this), leftover);
        collateral.gem.exit(address(provider), leftover);
        provider.liquidation(urn, leftover);
      }
    } else {
      IERC20(collateral.gem.gem()).safeTransfer(receiverAddress, gemBal);
    }
  }

  function getAllActiveAuctionsForJail(JailLike jail)
    external
    view
    returns (Sale[] memory sales)
  {
    uint256[] memory auctionIds = jail.list();
    uint256 auctionsCount = auctionIds.length;
    sales = new Sale[](auctionsCount);
    for (uint256 i = 0; i < auctionsCount; i++) {
      sales[i] = jail.sales(auctionIds[i]);
    }
  }
}
