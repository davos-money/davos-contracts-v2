let hre = require("hardhat");
let {ethers, upgrades} = require("hardhat");
const fs = require("fs");

/////////////////////////////
// 1_swapBurn.deploy.js //
/////////////////////////////

async function main() {

    // Signer
    [deployer] = await ethers.getSigners();
    let initialNonce = await ethers.provider.getTransactionCount(deployer.address);
    let _nonce = initialNonce

    // Config
    let { _swapBurn_router, _swapBurn__permit2, _swapBurn_priceFeed, _swapBurn_tokenOut, _swapBurn_fee, _swapBurn_tickSpacing, _swapBurn_deadline, _swapBurn_slippage, _swapBurn_yieldModule } = require(`./configs/${hre.network.name}.json`);

    // Addresses
    let { _vow } = require(`../protocol/addresses/${hre.network.name}_1.json`);

    // Fetching
    this.SwapBurn = await hre.ethers.getContractFactory("SwapBurn");
    let yieldModule = await hre.ethers.getContractAt("YieldModule", _swapBurn_yieldModule);
    
    // Deployment
    console.log("Module...");

    let swapBurn = await upgrades.deployProxy(this.SwapBurn, [_vow, _swapBurn_router, _swapBurn__permit2, _swapBurn_priceFeed], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await swapBurn.deployed();
    swapBurnImp = await upgrades.erc1967.getImplementationAddress(swapBurn.address);
    console.log("SwapBurn        :", swapBurn.address);
    console.log("Imp             :", swapBurnImp);

    // Set Params
    await swapBurn.setParams(_swapBurn_tokenOut, _swapBurn_fee, _swapBurn_tickSpacing, _swapBurn_deadline, _swapBurn_slippage, {nonce: _nonce}); _nonce += 1; console.log("1");
    
    // Add pluging to modulle
    await yieldModule.changePlugin(swapBurn.address, {nonce: _nonce}); _nonce += 1; console.log("2");

    // Store Deployed Contracts
    const addresses = {
        _swapBurn    : swapBurn.address,
        _swapBurnImp : swapBurnImp,
        _initialNonce: initialNonce
    }

    const json_addresses = JSON.stringify(addresses);
    fs.writeFileSync(`./scripts/plugin/addresses/${hre.network.name}_1.json`, json_addresses);
    console.log("Recorded to: " + `./scripts/plugin/addresses/${hre.network.name}_1.json`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
});