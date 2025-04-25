let hre = require("hardhat");
let {ethers, upgrades} = require("hardhat");
const fs = require("fs");

/////////////////////////////
// 1_yieldModule.deploy.js //
/////////////////////////////

async function main() {

    // Signer
    [deployer] = await ethers.getSigners();
    let initialNonce = await ethers.provider.getTransactionCount(deployer.address);
    let _nonce = initialNonce

    // Config
    let { _yieldModule_masterVault, _yieldModule_yieldMargin, _yieldModule_context } = require(`./configs/${hre.network.name}.json`);
    let { _licensor } = require(`../collateral/configs/${hre.network.name}.json`);

    // Addresses
    let { _priceController } = require(`../protocol/addresses/${hre.network.name}_3.json`);

    // Fetching
    this.YieldModule = await hre.ethers.getContractFactory("YieldModule");
    let masterVault = await hre.ethers.getContractAt("MasterVault", _yieldModule_masterVault);
    
    // Deployment
    console.log("Module...");

    let yieldModule = await upgrades.deployProxy(this.YieldModule, [_yieldModule_masterVault, _licensor, _yieldModule_yieldMargin], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await yieldModule.deployed();
    yieldModuleImp = await upgrades.erc1967.getImplementationAddress(yieldModule.address);
    console.log("YieldModule     :", yieldModule.address);
    console.log("Imp             :", yieldModuleImp);

    // Set PriceController
    await yieldModule.changePriceController(_priceController, {nonce: _nonce}); _nonce += 1; console.log("1");
    
    // Add yieldModule to MasterVault
    await masterVault.addModule(yieldModule.address, _yieldModule_context, {nonce: _nonce}); _nonce += 1; console.log("2");

    // Store Deployed Contracts
    const addresses = {
        _yieldModule    : yieldModule.address,
        _yieldModuleImp : yieldModuleImp,
        _initialNonce   : initialNonce
    }

    const json_addresses = JSON.stringify(addresses);
    fs.writeFileSync(`./scripts/module/addresses/${hre.network.name}_1.json`, json_addresses);
    console.log("Recorded to: " + `./scripts/module/addresses/${hre.network.name}_1.json`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
});