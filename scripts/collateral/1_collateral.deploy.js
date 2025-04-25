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
    let { _vat, _spot, _dog } = require(`../protocol/addresses/${hre.network.name}_1.json`);
    let { _interaction } = require(`../protocol/addresses/${hre.network.name}_2.json`);

    // Fetching
    this.MasterVault = await hre.ethers.getContractFactory("MasterVault");
    this.DavosProvider = await hre.ethers.getContractFactory("DavosProvider");
    this.DCol = await hre.ethers.getContractFactory("dCol");
    this.GemJoin = await hre.ethers.getContractFactory("GemJoin");
    this.Clip = await hre.ethers.getContractFactory("Clipper");

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

    let davosProvider = await upgrades.deployProxy(this.DavosProvider, [_underlying, DCol.address, masterVault.address, _interaction, false], {initializer: "initialize", nonce: _nonce}); _nonce += 1
    await davosProvider.deployed();
    let davosProviderImp = await upgrades.erc1967.getImplementationAddress(davosProvider.address);
    console.log("DavosProvider    : " + davosProvider.address);
    console.log("imp              : " + davosProviderImp);

    let gemJoin = await upgrades.deployProxy(this.GemJoin, [_vat, _ilk, masterVault.address], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await gemJoin.deployed();
    let gemJoinImp = await upgrades.erc1967.getImplementationAddress(gemJoin.address);
    console.log("GemJoin          :", gemJoin.address);
    console.log("Imp              :", gemJoinImp);

    let clip = await upgrades.deployProxy(this.Clip, [_vat, _spot, _dog, _ilk], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await clip.deployed();
    let clipImp = await upgrades.erc1967.getImplementationAddress(clip.address);
    console.log("Clip             :", clip.address);
    console.log("Imp              :", clipImp);

    // Store Deployed Contracts
    const addresses = {
        _masterVault     : masterVault.address,
        _masterVaultImp  : masterVaultImp,
        _DCol          : DCol.address,
        _DColImp       : DColImp,
        _davosProvider   : davosProvider.address,
        _davosProviderImp: davosProviderImp,
        _gemJoin         : gemJoin.address,
        _gemJoinImp      : gemJoinImp,
        _clip            : clip.address,
        _clipImp         : clipImp,
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