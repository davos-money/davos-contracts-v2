// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.10;
import { IERC20                } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { SafeERC20             } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockVow {

    using SafeERC20 for IERC20;

    address davos;
    constructor(address d) {
        davos = d;
    }
    function feed(uint wad) external {
        IERC20(davos).safeTransferFrom(msg.sender, address(this), wad);
    }
}