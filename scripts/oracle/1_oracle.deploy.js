let hre = require("hardhat");
let {ethers, upgrades} = require("hardhat");
const fs = require("fs");

////////////////////////
// 1_oracle.deploy.js //
////////////////////////

async function main() {

    // Signer
    [deployer] = await ethers.getSigners();
    let initialNonce = await ethers.provider.getTransactionCount(deployer.address);
    let _nonce = initialNonce

    // Config
    let { _aggregator, _lst, _masterVault } = require(`./configs/${hre.network.name}.json`);

    // Addresses
    let { _priceController } = require(`../protocol/addresses/${hre.network.name}_3.json`);

    // Fetching
    this.CollateralOracle = await hre.ethers.getContractFactory("CollateralOracle");

    // Deployment
    console.log("Oracle...");

    let collateralOracle = await upgrades.deployProxy(this.CollateralOracle, [_aggregator, _lst, _masterVault, _priceController], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await collateralOracle.deployed();
    collateralOracleImp = await upgrades.erc1967.getImplementationAddress(collateralOracle.address);
    console.log("CollateralOracle:", collateralOracle.address);
    console.log("Imp             :", collateralOracleImp);

    // Store Deployed Contracts
    const addresses = {
        _collateralOracle    : collateralOracle.address,
        _collateralOracleImp : collateralOracleImp,
        _initialNonce        : initialNonce
    }

    const json_addresses = JSON.stringify(addresses);
    fs.writeFileSync(`./scripts/oracle/addresses/${hre.network.name}_1.json`, json_addresses);
    console.log("Recorded to: " + `./scripts/oracle/addresses/${hre.network.name}_1.json`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
});