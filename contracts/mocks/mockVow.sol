// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.10;
import { IERC20                } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { SafeERC20             } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockSettlement {

    using SafeERC20 for IERC20;

    address stablecoin;
    constructor(address d) {
        stablecoin = d;
    }
    function feed(uint wad) external {
        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), wad);
    }
}