// SPDX-License-Identifier: AGPL-3.0-or-later
// Modified version of MakerDAO (https://github.com/makerdao/dss/blob/master/src/dai.sol)
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IStablecoin.sol";

// --- stablecoin.sol --- Stablecoin ERC-20
contract Stablecoin is Initializable, IStablecoin {
    
    // --- Auth ---
    mapping (address => uint) public wards;
    function rely(address guy) external auth { wards[guy] = 1; }
    function deny(address guy) external auth { wards[guy] = 0; }
    modifier auth {
        require(wards[msg.sender] == 1, "Stablecoin/not-authorized");
        _;
    }

    // --- ERC20 Data ---
    string  public constant name     = "Stablecoin";
    string  public symbol;
    string  public constant version  = "1";
    uint8   public constant decimals = 18;
    uint256 public totalSupply;

    mapping (address => uint)                      public balanceOf;
    mapping (address => mapping (address => uint)) public allowance;
    mapping (address => uint)                      public nonces;

    uint256 public supplyCap;

    event SupplyCapSet(uint256 oldCap, uint256 newCap);

    // --- EIP712 niceties ---
    bytes32 public DOMAIN_SEPARATOR;
    // bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)");
    bytes32 public constant PERMIT_TYPEHASH = 0xea2aa0a1be11a07ed86d755c93467f4f82362b452371d1ba94d1715123511acb;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    function initialize(uint256 chainId_, string memory symbol_, uint256 supplyCap_) external initializer {
        wards[msg.sender] = 1;
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(name)),
            keccak256(bytes(version)),
            chainId_,
            address(this)
        ));
        symbol = symbol_;
        supplyCap = supplyCap_;
    }

    // --- Token ---
    function transfer(address dst, uint wad) external returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }
    function transferFrom(address src, address dst, uint wad) public returns (bool) {
        require(src != address(0), "Stablecoin/transfer-from-zero-address");
        require(dst != address(0), "Stablecoin/transfer-to-zero-address");
        require(balanceOf[src] >= wad, "Stablecoin/insufficient-balance");
        if (src != msg.sender && allowance[src][msg.sender] != type(uint256).max) {
            require(allowance[src][msg.sender] >= wad, "Stablecoin/insufficient-allowance");
            allowance[src][msg.sender] -= wad;
        }
        balanceOf[src] -= wad;
        balanceOf[dst] += wad;
        emit Transfer(src, dst, wad);
        return true;
    }
    function mint(address usr, uint wad) external auth {
        require(usr != address(0), "Stablecoin/mint-to-zero-address");
        require(totalSupply + wad <= supplyCap, "Stablecoin/cap-reached");
        balanceOf[usr] += wad;
        totalSupply    += wad;
        emit Transfer(address(0), usr, wad);
    }
    function burn(address usr, uint wad) external {
        require(usr != address(0), "Stablecoin/burn-from-zero-address");
        require(balanceOf[usr] >= wad, "Stablecoin/insufficient-balance");
        if (usr != msg.sender && allowance[usr][msg.sender] != type(uint256).max) {
            require(allowance[usr][msg.sender] >= wad, "Stablecoin/insufficient-allowance");
            allowance[usr][msg.sender] -= wad;
        }
        balanceOf[usr] -= wad;
        totalSupply    -= wad;
        emit Transfer(usr, address(0), wad);
    }
    function approve(address usr, uint wad) external returns (bool) {
        _approve(msg.sender, usr, wad);

        return true;
    }

    // --- Alias ---
    function push(address usr, uint wad) external {
        transferFrom(msg.sender, usr, wad);
    }
    function pull(address usr, uint wad) external {
        transferFrom(usr, msg.sender, wad);
    }
    function move(address src, address dst, uint wad) external {
        transferFrom(src, dst, wad);
    }

    // --- Approve by signature ---
    function permit(address holder, address spender, uint256 nonce, uint256 expiry,
                    bool allowed, uint8 v, bytes32 r, bytes32 s) external
    {
        bytes32 digest =
            keccak256(abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PERMIT_TYPEHASH,
                                     holder,
                                     spender,
                                     nonce,
                                     expiry,
                                     allowed))
        ));

        require(holder != address(0), "Stablecoin/invalid-address-0");
        require(holder == ECDSA.recover(digest, v, r, s), "Stablecoin/invalid-permit");
        require(expiry == 0 || block.timestamp <= expiry, "Stablecoin/permit-expired");
        require(nonce == nonces[holder]++, "Stablecoin/invalid-nonce");
        uint wad = allowed ? type(uint256).max : 0;
        allowance[holder][spender] = wad;
        emit Approval(holder, spender, wad);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "Stablecoin/approve-from-zero-address");
        require(spender != address(0), "Stablecoin/approve-to-zero-address");

        allowance[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        address owner = msg.sender;
        _approve(owner, spender, allowance[owner][spender] + addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        address owner = msg.sender;
        uint256 currentAllowance = allowance[owner][spender];
        require(currentAllowance >= subtractedValue, "Stablecoin/decreased-allowance-below-zero");
        unchecked {
            _approve(owner, spender, currentAllowance - subtractedValue);
        }
        return true;
    }

    function setSupplyCap(uint256 wad) public auth {
        require(wad >= totalSupply, "Stablecoin/more-supply-than-cap");
        uint256 oldCap = supplyCap;
        supplyCap = wad;
        emit SupplyCapSet(oldCap, supplyCap);
    }

    function updateDomainSeparator(uint256 chainId_) external auth {
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(name)),
            keccak256(bytes(version)),
            chainId_,
            address(this)
        ));
    }
}