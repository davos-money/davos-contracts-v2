let hre = require("hardhat");
let {ethers, upgrades} = require("hardhat");
const fs = require("fs");

//////////////////////
// 1_core.deploy.js //
//////////////////////

let wad = "000000000000000000";

async function main() {

    // Signer
    [deployer] = await ethers.getSigners();
    let initialNonce = await ethers.provider.getTransactionCount(deployer.address);
    let _nonce = initialNonce
        
    // Config 
    let { _chainId, _multisig, _supplyCap } = require(`./configs/${hre.network.name}.json`);

    // Fetching
    this.Ledger = await hre.ethers.getContractFactory("Ledger");
    this.Vision = await hre.ethers.getContractFactory("Vision");
    this.Stablecoin = await hre.ethers.getContractFactory("Stablecoin");
    this.StablecoinJoin = await hre.ethers.getContractFactory("StablecoinJoin");
    this.Fee = await hre.ethers.getContractFactory("Fee");
    this.Settlement = await hre.ethers.getContractFactory("Settlement");
    this.Liquidator = await hre.ethers.getContractFactory("Liquidator");
    this.Decay = await hre.ethers.getContractFactory("LinearDecrease");

    // Deployment
    console.log("Core...");
    
    let ledger = await upgrades.deployProxy(this.Ledger, [], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await ledger.deployed();
    ledgerImp = await upgrades.erc1967.getImplementationAddress(ledger.address);
    console.log("Ledger             :", ledger.address);
    console.log("LedgerImp          :", ledgerImp);

    let vision = await upgrades.deployProxy(this.Vision, [ledger.address], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await vision.deployed();
    visionImp = await upgrades.erc1967.getImplementationAddress(vision.address);
    console.log("Vision            :", vision.address);
    console.log("VisionImp         :", visionImp)

    let stablecoin = await upgrades.deployProxy(this.Stablecoin, [_chainId, "STC", _supplyCap + wad], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await stablecoin.deployed();
    stablecoinImp = await upgrades.erc1967.getImplementationAddress(stablecoin.address);
    console.log("stablecoin           :", stablecoin.address);
    console.log("stablecoinImp        :", stablecoinImp);

    let stablecoinJoin = await upgrades.deployProxy(this.StablecoinJoin, [ledger.address, stablecoin.address], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await stablecoinJoin.deployed();
    stablecoinJoinImp = await upgrades.erc1967.getImplementationAddress(stablecoinJoin.address);
    console.log("StablecoinJoin       :", stablecoinJoin.address);
    console.log("StablecoinJoinImp    :", stablecoinJoinImp)

    let settlement = await upgrades.deployProxy(this.Settlement, [ledger.address, stablecoinJoin.address, _multisig], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await settlement.deployed();
    settlementImp = await upgrades.erc1967.getImplementationAddress(settlement.address);
    console.log("Settlement             :", settlement.address);
    console.log("SettlementImp          :", settlementImp);

    let liquidator = await upgrades.deployProxy(this.Liquidator, [ledger.address], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await liquidator.deployed();
    liquidatorImpl = await upgrades.erc1967.getImplementationAddress(liquidator.address);
    console.log("Liquidator             :", liquidator.address);
    console.log("LiquidatorImp          :", liquidatorImpl);

    let fee = await upgrades.deployProxy(this.Fee, [ledger.address], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await fee.deployed();
    feeImp = await upgrades.erc1967.getImplementationAddress(fee.address);
    console.log("Fee             :", fee.address);
    console.log("FeeImp          :", feeImp);

    let decay = await upgrades.deployProxy(this.Decay, [], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await decay.deployed();
    decayImp = await upgrades.erc1967.getImplementationAddress(decay.address);
    console.log("Decay          :", decay.address);
    console.log("DecayImp       :", decayImp);

    // Store Deployed Contracts
    const addresses = {
        _ledger            : ledger.address,
        _ledgerImp         : ledgerImp,
        _vision            : vision.address,
        _visionImp         : visionImp,
        _stablecoin        : stablecoin.address,
        _stablecoinImp     : stablecoinImp,
        _stablecoinJoin    : stablecoinJoin.address,
        _stablecoinJoinImp : stablecoinJoinImp,
        _settlement        : settlement.address,
        _settlementImp     : settlementImp,
        _liquidator        : liquidator.address,
        _liquidaImp        : liquidatorImpl,
        _fee               : fee.address,
        _feeImp            : feeImp,
        _decay             : decay.address,
        _decayImp          : decayImp,
        _initialNonce      : initialNonce
    }

    const json_addresses = JSON.stringify(addresses);
    fs.writeFileSync(`./scripts/protocol/addresses/${hre.network.name}_1.json`, json_addresses);
    console.log("Recorded to: " + `./scripts/protocol/addresses/${hre.network.name}_1.json`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
});