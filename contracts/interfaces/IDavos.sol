// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";

interface IDavos is IERC20Metadata {
  function mint(address, uint256) external;

  function burn(address, uint256) external;
}