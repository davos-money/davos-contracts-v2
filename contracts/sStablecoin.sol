// SPDX-License-Identifier: AGPL-3.0-or-later
// Modified version of MakerDAO (https://github.com/makerdao/sdai/blob/master/src/SavingsDai.sol)
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/ISStablecoin.sol";

// --- sStablecoin --- A tokenized representation stablecoin in the DSR (savings)
contract sStablecoin is ISStablecoin, Initializable {

    // --- Data ---
    string  public constant name     = "Staked Stablecoin";
    string  public constant symbol   = "sSTC";
    string  public constant version  = "1";
    uint8   public constant decimals = 18;
    uint256 public totalSupply;

    mapping (address => uint256)                      public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;
    mapping (address => uint256)                      public nonces;

    LedgerLike         public ledger;
    StablecoinJoinLike public stablecoinJoin;
    IStablecoin        public stablecoin;
    SavingsLike        public savings;

    // --- EIP712 niceties ---
    uint256 public deploymentChainId;
    bytes32 private _DOMAIN_SEPARATOR;
    bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    
    uint256 public constant RAY = 10 ** 27;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // --- Constructor ---
    constructor() { _disableInitializers(); }

    // --- Init ---
    function initialize(address _stablecoinJoin, address _savings) external initializer {
        stablecoinJoin = StablecoinJoinLike(_stablecoinJoin);
        ledger = LedgerLike(stablecoinJoin.ledger());
        stablecoin = IStablecoin(stablecoinJoin.stablecoin());
        savings = SavingsLike(_savings);

        deploymentChainId = block.chainid;
        _DOMAIN_SEPARATOR = _calculateDomainSeparator(block.chainid);

        ledger.hope(address(stablecoinJoin));
        ledger.hope(address(savings));

        stablecoin.approve(address(stablecoinJoin), type(uint256).max);
    }
    function _calculateDomainSeparator(uint256 chainId) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                address(this)
            )
        );
    }
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return block.chainid == deploymentChainId ? _DOMAIN_SEPARATOR : _calculateDomainSeparator(block.chainid);
    }
    function _rpow(uint256 x, uint256 n) internal pure returns (uint256 z) {
        assembly {
            switch x case 0 {switch n case 0 {z := RAY} default {z := 0}}
            default {
                switch mod(n, 2) case 0 { z := RAY } default { z := x }
                let half := div(RAY, 2)  // for rounding.
                for { n := div(n, 2) } n { n := div(n,2) } {
                    let xx := mul(x, x)
                    if iszero(eq(div(xx, x), x)) { revert(0,0) }
                    let xxRound := add(xx, half)
                    if lt(xxRound, xx) { revert(0,0) }
                    x := div(xxRound, RAY)
                    if mod(n,2) {
                        let zx := mul(z, x)
                        if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) { revert(0,0) }
                        let zxRound := add(zx, half)
                        if lt(zxRound, zx) { revert(0,0) }
                        z := div(zxRound, RAY)
                    }
                }
            }
        }
    }
    function _divup(uint256 x, uint256 y) internal pure returns (uint256 z) {
        unchecked {
            z = x != 0 ? ((x - 1) / y) + 1 : 0;
        }
    }

    // --- ERC20 Mutations ---
    function transfer(address to, uint256 value) external returns (bool) {
        require(to != address(0) && to != address(this), "SavingsStablecoin/invalid-address");
        uint256 balance = balanceOf[msg.sender];
        require(balance >= value, "SavingsStablecoin/insufficient-balance");

        unchecked {
            balanceOf[msg.sender] = balance - value;
            balanceOf[to] += value;
        }

        emit Transfer(msg.sender, to, value);

        return true;
    }
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(to != address(0) && to != address(this), "SavingsStablecoin/invalid-address");
        uint256 balance = balanceOf[from];
        require(balance >= value, "SavingsStablecoin/insufficient-balance");

        if (from != msg.sender) {
            uint256 allowed = allowance[from][msg.sender];
            if (allowed != type(uint256).max) {
                require(allowed >= value, "SavingsStablecoin/insufficient-allowance");

                unchecked {
                    allowance[from][msg.sender] = allowed - value;
                }
            }
        }

        unchecked {
            balanceOf[from] = balance - value;
            balanceOf[to] += value;
        }

        emit Transfer(from, to, value);

        return true;
    }
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;

        emit Approval(msg.sender, spender, value);

        return true;
    }
    function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
        uint256 newValue = allowance[msg.sender][spender] + addedValue;
        allowance[msg.sender][spender] = newValue;

        emit Approval(msg.sender, spender, newValue);

        return true;
    }
    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        uint256 allowed = allowance[msg.sender][spender];
        require(allowed >= subtractedValue, "SavingsStablecoin/insufficient-allowance");
        unchecked{
            allowed = allowed - subtractedValue;
        }
        allowance[msg.sender][spender] = allowed;

        emit Approval(msg.sender, spender, allowed);

        return true;
    }

    // --- Mint/Burn Internal ---
    function _mint(uint256 assets, uint256 shares, address receiver) internal {
        require(receiver != address(0) && receiver != address(this), "SavingsStablecoin/invalid-address");

        stablecoin.transferFrom(msg.sender, address(this), assets);
        stablecoinJoin.join(address(this), assets);
        savings.join(shares);

        // note: we don't need an overflow check here b/c shares totalSupply will always be <= stablecoin totalSupply
        unchecked {
            balanceOf[receiver] = balanceOf[receiver] + shares;
            totalSupply = totalSupply + shares;
        }

        emit Deposit(msg.sender, receiver, assets, shares);
        emit Transfer(address(0), receiver, shares);
    }
    function _burn(uint256 assets, uint256 shares, address receiver, address owner) internal {
        uint256 balance = balanceOf[owner];
        require(balance >= shares, "SavingsStablecoin/insufficient-balance");

        if (owner != msg.sender) {
            uint256 allowed = allowance[owner][msg.sender];
            if (allowed != type(uint256).max) {
                require(allowed >= shares, "SavingsStablecoin/insufficient-allowance");

                unchecked {
                    allowance[owner][msg.sender] = allowed - shares;
                }
            }
        }

        unchecked {
            balanceOf[owner] = balance - shares; // note: we don't need overflow checks b/c require(balance >= value) and balance <= totalSupply
            totalSupply      = totalSupply - shares;
        }

        savings.exit(shares);
        stablecoinJoin.exit(receiver, assets);

        emit Transfer(owner, address(0), shares);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    // --- ERC-4626 ---
    function asset() external view returns (address) {
        return address(stablecoin);
    }
    function totalAssets() external view returns (uint256) {
        return convertToAssets(totalSupply);
    }
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 rho = savings.rho();
        uint256 chi = (block.timestamp > rho) ? _rpow(savings.dsr(), block.timestamp - rho) * savings.chi() / RAY : savings.chi();
        return assets * RAY / chi;
    }
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 rho = savings.rho();
        uint256 chi = (block.timestamp > rho) ? _rpow(savings.dsr(), block.timestamp - rho) * savings.chi() / RAY : savings.chi();
        return shares * chi / RAY;
    }
    function maxDeposit(address) external pure returns (uint256) {
        return type(uint256).max;
    }
    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }
    function deposit(uint256 assets, address receiver) public returns (uint256 shares) {
        uint256 chi = (block.timestamp > savings.rho()) ? savings.drip() : savings.chi();
        shares = assets * RAY / chi;
        _mint(assets, shares, receiver);
    }
    function deposit(uint256 assets, address receiver, uint16 referral) external returns (uint256 shares) {
        shares = deposit(assets, receiver);
        emit Referral(referral, receiver, assets, shares);
    }
    function maxMint(address) external pure returns (uint256) {
        return type(uint256).max;
    }
    function previewMint(uint256 shares) external view returns (uint256) {
        uint256 rho = savings.rho();
        uint256 chi = (block.timestamp > rho) ? _rpow(savings.dsr(), block.timestamp - rho) * savings.chi() / RAY : savings.chi();
        return _divup(shares * chi, RAY);
    }
    function mint(uint256 shares, address receiver) public returns (uint256 assets) {
        uint256 chi = (block.timestamp > savings.rho()) ? savings.drip() : savings.chi();
        assets = _divup(shares * chi, RAY);
        _mint(assets, shares, receiver);
    }
    function mint(uint256 shares, address receiver, uint16 referral) external returns (uint256 assets) {
        assets = mint(shares, receiver);
        emit Referral(referral, receiver, assets, shares);
    }
    function maxWithdraw(address owner) external view returns (uint256) {
        return convertToAssets(balanceOf[owner]);
    }
    function previewWithdraw(uint256 assets) external view returns (uint256) {
        uint256 rho = savings.rho();
        uint256 chi = (block.timestamp > rho) ? _rpow(savings.dsr(), block.timestamp - rho) * savings.chi() / RAY : savings.chi();
        return _divup(assets * RAY, chi);
    }
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        uint256 chi = (block.timestamp > savings.rho()) ? savings.drip() : savings.chi();
        shares = _divup(assets * RAY, chi);
        _burn(assets, shares, receiver, owner);
    }
    function maxRedeem(address owner) external view returns (uint256) {
        return balanceOf[owner];
    }
    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        uint256 chi = (block.timestamp > savings.rho()) ? savings.drip() : savings.chi();
        assets = shares * chi / RAY;
        _burn(assets, shares, receiver, owner);
    }

    // --- Approve by signature ---
    function _isValidSignature(address signer, bytes32 digest, bytes memory signature) internal view returns (bool) {
        if (signature.length == 65) {
            bytes32 r;
            bytes32 s;
            uint8 v;
            assembly {
                r := mload(add(signature, 0x20))
                s := mload(add(signature, 0x40))
                v := byte(0, mload(add(signature, 0x60)))
            }
            if (signer == ecrecover(digest, v, r, s)) {
                return true;
            }
        }

        (bool success, bytes memory result) = signer.staticcall(
            abi.encodeWithSelector(IERC1271.isValidSignature.selector, digest, signature)
        );
        return (success &&
            result.length == 32 &&
            abi.decode(result, (bytes4)) == IERC1271.isValidSignature.selector);
    }
    function permit(address owner, address spender, uint256 value, uint256 deadline, bytes memory signature) public {
        require(block.timestamp <= deadline, "SavingsStablecoin/permit-expired");
        require(owner != address(0), "SavingsStablecoin/invalid-owner");

        uint256 nonce;
        unchecked { nonce = nonces[owner]++; }

        bytes32 digest =
            keccak256(abi.encodePacked(
                "\x19\x01",
                block.chainid == deploymentChainId ? _DOMAIN_SEPARATOR : _calculateDomainSeparator(block.chainid),
                keccak256(abi.encode(
                    PERMIT_TYPEHASH,
                    owner,
                    spender,
                    value,
                    nonce,
                    deadline
                ))
            ));

        require(_isValidSignature(owner, digest, signature), "SavingsStablecoin/invalid-permit");

        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        permit(owner, spender, value, deadline, abi.encodePacked(r, s, v));
    }
}