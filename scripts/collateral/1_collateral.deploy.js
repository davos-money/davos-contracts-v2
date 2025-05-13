let hre = require("hardhat");
let {ethers, upgrades} = require("hardhat");
const fs = require("fs");

////////////////////////////
// 1_collateral.deploy.js //
////////////////////////////

async function main() {

    // Signer
    [deployer] = await ethers.getSigners();
    let initialNonce = await ethers.provider.getTransactionCount(deployer.address);
    let _nonce = initialNonce

    // Config
    let { _underlying, _ilk} = require(`./configs/${hre.network.name}.json`);

    // Addresses
    let { _ledger, _vision, _liquidator } = require(`../protocol/addresses/${hre.network.name}_1.json`);
    let { _interaction } = require(`../protocol/addresses/${hre.network.name}_2.json`);

    // Fetching
    this.MasterVault = await hre.ethers.getContractFactory("MasterVault");
    this.Provider = await hre.ethers.getContractFactory("Provider");
    this.DCol = await hre.ethers.getContractFactory("dCol");
    this.GemJoin = await hre.ethers.getContractFactory("GemJoin");
    this.Jail = await hre.ethers.getContractFactory("Jail");

    // Deployment
    console.log("Deploying...");

    let masterVault = await upgrades.deployProxy(this.MasterVault, ["MasterVault Token", "MVT", _underlying], {initializer: "initialize", nonce: _nonce}); _nonce += 1
    await masterVault.deployed();
    let masterVaultImp = await upgrades.erc1967.getImplementationAddress(masterVault.address);
    console.log("MasterVault      : " + masterVault.address);
    console.log("Imp              : " + masterVaultImp);

    let DCol = await upgrades.deployProxy(this.DCol, [], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await DCol.deployed();
    let DColImp = await upgrades.erc1967.getImplementationAddress(DCol.address);
    console.log("DCol           : " + DCol.address);
    console.log("imp              : " + DColImp);

    let Provider = await upgrades.deployProxy(this.Provider, [_underlying, DCol.address, masterVault.address, _interaction, false], {initializer: "initialize", nonce: _nonce}); _nonce += 1
    await Provider.deployed();
    let ProviderImp = await upgrades.erc1967.getImplementationAddress(Provider.address);
    console.log("Provider    : " + Provider.address);
    console.log("imp              : " + ProviderImp);

    let gemJoin = await upgrades.deployProxy(this.GemJoin, [_ledger, _ilk, masterVault.address], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await gemJoin.deployed();
    let gemJoinImp = await upgrades.erc1967.getImplementationAddress(gemJoin.address);
    console.log("GemJoin          :", gemJoin.address);
    console.log("Imp              :", gemJoinImp);

    let jail = await upgrades.deployProxy(this.Jail, [_ledger, _vision, _liquidator, _ilk], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await jail.deployed();
    let jailImp = await upgrades.erc1967.getImplementationAddress(jail.address);
    console.log("Jail             :", jail.address);
    console.log("Imp              :", jailImp);

    // Store Deployed Contracts
    const addresses = {
        _masterVault     : masterVault.address,
        _masterVaultImp  : masterVaultImp,
        _DCol          : DCol.address,
        _DColImp       : DColImp,
        _Provider   : Provider.address,
        _ProviderImp: ProviderImp,
        _gemJoin         : gemJoin.address,
        _gemJoinImp      : gemJoinImp,
        _jail            : jail.address,
        _jailImp         : jailImp,
        _initialNonce    : initialNonce
    }

    const json_addresses = JSON.stringify(addresses);
    fs.writeFileSync(`./scripts/collateral/addresses/${network.name}_1.json`, json_addresses);
    console.log("Recorded to: " + `./scripts/collateral/addresses/${network.name}_1.json`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
});