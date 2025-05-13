//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../fee.sol";

interface GemLike {
    function approve(address, uint) external;
    function transfer(address, uint) external;
    function transferFrom(address, address, uint) external;
    function deposit() external payable;
    function withdraw(uint) external;
}

interface DaiJoinLike {
    function dai() external returns (GemLike);
    function join(address, uint) external payable;
    function exit(address, uint) external;
}

contract ProxyLike is Ownable {
    uint256 constant RAY = 10 ** 27;
    address fee;
    address ledger;
    constructor(address _fee, address _ledger) Ownable(msg.sender) {
        fee = _fee;
        ledger = _ledger;
    }

    function sub(uint x, uint y) internal pure returns (uint z) {
        unchecked {
            require((z = x - y) <= x, "sub-overflow");    
        } 
    }

    function mul(uint x, uint y) internal pure returns (uint z) {
        unchecked {
            require(y == 0 || (z = x * y) / y == x, "mul-overflow");
        }
    }

    function feeInitFile(bytes32 _gem, bytes32 _what, uint256 _rate) external onlyOwner {
        Fee(fee).init(_gem);
        Fee(fee).file(_gem, _what, _rate);
    }
}