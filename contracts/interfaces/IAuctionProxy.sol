// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./StablecoinJoinLike.sol";
import "./LedgerLike.sol";
import "./JailLike.sol";
import "./LiquidatorLike.sol";
import { CollateralType } from "./IInteraction.sol";
import "../provider/interfaces/IProvider.sol";

interface IAuctionProxy {

    function startAuction(
        address token,
        address user,
        address keeper
    ) external returns (uint256 id);

    function buyFromAuction(
        address user,
        uint256 auctionId,
        uint256 collateralAmount,
        uint256 maxPrice,
        address receiverAddress
    ) external;

    function getAllActiveAuctionsForToken(address token) external view returns (Sale[] memory sales);
}
