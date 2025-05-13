let hre = require("hardhat");
let {ethers} = require("hardhat");

/////////////////////////
// 4_all.initialize.js //
/////////////////////////

let ray = "000000000000000000000000000", // 27 Decimals
    rad = "000000000000000000000000000000000000000000000"; // 45 Decimals

async function main() {

    // Signer
    [deployer] = await ethers.getSigners();
    let initialNonce = await ethers.provider.getTransactionCount(deployer.address);
    let _nonce = initialNonce

    // Config
    let { _ledger_Line, _vision_par, _liquidator_hole, _decay_tau } = require(`./configs/${hre.network.name}.json`);

    // Addresses
    let { _ledger, _vision, _stablecoin, _stablecoinJoin, _fee, _settlement, _liquidator, _decay } = require(`./addresses/${hre.network.name}_1.json`);
    let { _interaction } = require(`./addresses/${hre.network.name}_2.json`);

    // Attaching
    let ledger = await hre.ethers.getContractAt("Ledger", _ledger);
    let vision = await hre.ethers.getContractAt("Vision", _vision);
    let stablecoin = await hre.ethers.getContractAt("Stablecoin", _stablecoin);
    let stablecoinJoin = await hre.ethers.getContractAt("StablecoinJoin", _stablecoinJoin);
    let fee = await hre.ethers.getContractAt("Fee", _fee);
    let settlement = await hre.ethers.getContractAt("Settlement", _settlement);
    let liquidator = await hre.ethers.getContractAt("Liquidator", _liquidator);
    let decay = await hre.ethers.getContractAt("LinearDecrease", _decay);
 
    let interaction = await hre.ethers.getContractAt("Interaction", _interaction);

    console.log("Ledger init...");
    await ledger.rely(vision.address, {nonce: _nonce}); _nonce += 1;
    await ledger.rely(stablecoinJoin.address, {nonce: _nonce}); _nonce += 1;
    await ledger.rely(fee.address, {nonce: _nonce}); _nonce += 1;
    await ledger.rely(liquidator.address, {nonce: _nonce}); _nonce += 1;
    await ledger.rely(interaction.address, {nonce: _nonce}); _nonce += 1;
    await ledger["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Line"), _ledger_Line + rad, {nonce: _nonce}); _nonce += 1;
    
    console.log("Stablecoin init...");
    await stablecoin.rely(stablecoinJoin.address, {nonce: _nonce}); _nonce += 1;

    console.log("Vision init...");
    await vision.rely(interaction.address, {nonce: _nonce}); _nonce += 1;
    await vision["file(bytes32,uint256)"](ethers.utils.formatBytes32String("par"), _vision_par + ray, {nonce: _nonce}); _nonce += 1; // It means pegged to 1$

    console.log("Joins init...");
    await stablecoinJoin.rely(interaction.address, {nonce: _nonce}); _nonce += 1;
    await stablecoinJoin.rely(settlement.address, {nonce: _nonce}); _nonce += 1;

    console.log("Liquidator init...");
    await liquidator.rely(interaction.address, {nonce: _nonce}); _nonce += 1;
    await liquidator["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), settlement.address, {nonce: _nonce}); _nonce += 1;
    await liquidator["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Hole"), _liquidator_hole + rad, {nonce: _nonce}); _nonce += 1;

    console.log("Fee...");
    // Initialize Rates Module
    // IMPORTANT: Base and Duty are added together first, thus will compound together.
    //            It is adviced to set a constant base first then duty for all ilks.
    //            Otherwise, a change in base rate will require a change in all ilks rate.
    //            Due to addition of both rates, the ratio should be adjusted by factoring.
    //            rate(Base) + rate(Duty) != rate(Base + Duty)
    // Duty by default set to 1 Ray which is 0%, but added to Base that makes its effect compound
    // Calculating Base Rate (1% Yearly)
    // ==> principal*(rate**seconds)-principal = 0.01 (1%)
    // ==> 1 * (BR ** 31536000 seconds) - 1 = 0.01
    // ==> 1*(BR**31536000) = 1.01
    // ==> BR**31536000 = 1.01
    // ==> BR = 1.01**(1/31536000)
    // ==> BR = 1.000000000315529215730000000 [ray]
    // Factoring out Ilk Duty Rate (1% Yearly)
    // ((1 * (BR + 0.000000000312410000000000000 DR)^31536000)-1) * 100 = 0.000000000312410000000000000 = 2% (BR + DR Yearly)
    
    // 1000000000315522921573372069 1% Borrow Rate
    // 1000000000627937192491029810 2% Borrow Rate
    // 1000000000937303470807876290 3% Borrow Rate
    // 1000000003022266000000000000 10% Borrow Rate
    // ***We don't set base rate here. We set only duty rate via interaction***
    // await fee["file(bytes32,uint256)"](ethers.utils.formatBytes32String("base"), "1000000000627937192491029810"); - [Avoid this if no common rate]
    await fee.rely(interaction.address, {nonce: _nonce}); _nonce += 1;
    await fee["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), settlement.address, {nonce: _nonce}); _nonce += 1;

    console.log("Settlement init...");
    await settlement.rely(liquidator.address, {nonce: _nonce}); _nonce += 1;
    await settlement["file(bytes32,address)"](ethers.utils.formatBytes32String("stablecoin"), stablecoin.address, {nonce: _nonce}); _nonce += 1;
    
    console.log("decay init...");
    await decay.connect(deployer)["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tau"), _decay_tau, {nonce: _nonce}); _nonce += 1; // Price will reach 0 after this time

    console.log("Protocol Ready !!!");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
});