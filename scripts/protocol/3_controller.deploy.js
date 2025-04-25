let hre = require("hardhat");
let {ethers, upgrades} = require("hardhat");
const {ether} = require("@openzeppelin/test-helpers");
const fs = require("fs");

/////////////////////////////
// 3_controller.deploy.js //
/////////////////////////////

async function main() {

    // Signer
    [deployer] = await ethers.getSigners();
    let initialNonce = await ethers.provider.getTransactionCount(deployer.address);
    let _nonce = initialNonce

    // Fetching
    this.PriceController = await hre.ethers.getContractFactory("PriceController");

    // Deployment
    console.log("Controller...");

    let priceController = await upgrades.deployProxy(this.PriceController, [], {initializer: "initialize", nonce: _nonce}); _nonce += 1;
    await priceController.deployed();
    priceControllerImp = await upgrades.erc1967.getImplementationAddress(priceController.address);
    console.log("PriceController :", priceController.address);
    console.log("Imp             :", priceControllerImp);

    // Store Deployed Contracts
    const addresses = {
        _priceController     : priceController.address,
        _priceControllerImp  : priceControllerImp,
        _initialNonce        : initialNonce
    }

    const json_addresses = JSON.stringify(addresses);
    fs.writeFileSync(`./scripts/protocol/addresses/${hre.network.name}_3.json`, json_addresses);
    console.log("Recorded to: " + `./scripts/protocol/addresses/${hre.network.name}_3.json`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
});