//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract Oracle is Ownable {

    using Math for uint;

    event PriceUpdate(bytes32 price);

    bytes32 public price; 

    mapping(address => bool) public managers;

    modifier onlyOwnerOrManager {
        require(msg.sender == owner() || managers[msg.sender] == true);
        _;
    }

    constructor() Ownable(msg.sender) {

    }

    // Take care of decimals while setting a price for the test
    function setPrice(uint256 _price) external onlyOwnerOrManager {
        price = bytes32(_price);
        emit PriceUpdate(bytes32(_price));
    }

    function peek() view external returns(bytes32,bool) {
        if (price  == 0)
         return (0, false);
        return (price, true);
    }

    function setManager(address manager, bool value) external onlyOwner {
        managers[manager] = value;
    }
}