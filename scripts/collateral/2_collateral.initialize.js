let hre = require("hardhat");
let {ethers} = require("hardhat");

////////////////////////////////
// 2_collateral.initialize.js //
////////////////////////////////

let wad = "000000000000000000", // 18 Decimals
    ray = "000000000000000000000000000", // 27 Decimals
    rad = "000000000000000000000000000000000000000000000", // 45 Decimals
    ONE = 10 ** 27;

async function main() {

    // Signer
    [deployer] = await ethers.getSigners();
    let initialNonce = await ethers.provider.getTransactionCount(deployer.address);
    let _nonce = initialNonce

    // Config
    let { _ilk, _liquidator_hole, _liquidator_chop, _jail_buf, _jail_tail, _jail_cusp, _jail_chip, _jail_tip, _jail_stopped, _ledger_line, _ledger_dust, _fee_duty, _mat} = require(`./configs/${hre.network.name}.json`);

    // Addresses
    let { _ledger, _vision, _liquidator, _settlement, _decay } = require(`../protocol/addresses/${hre.network.name}_1.json`);
    let { _interaction, _auctionProxy } = require(`../protocol/addresses/${hre.network.name}_2.json`);
    let { _masterVault, _Provider, _dCol, _jail, _gemJoin } = require(`../collateral/addresses/${hre.network.name}_1.json`);
    let { _collateralOracle } = require(`../oracle/addresses/${hre.network.name}_1.json`);

    // Fetching
    this.Interaction = await hre.ethers.getContractFactory("Interaction", {
        unsafeAllow: ['external-library-linking'],
        libraries: {
            AuctionProxy: _auctionProxy
        }
    });
    let interactionAttached = await this.Interaction.attach(_interaction);

    let masterVaultAt = await ethers.getContractAt("MasterVault", _masterVault);
    let dColAt = await ethers.getContractAt("dCol", _dCol);
    let jailAt = await ethers.getContractAt("Jail", _jail);
    let gemJoinAt = await ethers.getContractAt("GemJoin", _gemJoin);
    let ledgerAt = await ethers.getContractAt("Ledger", _ledger);
    let liquidatorAt = await ethers.getContractAt("Liquidator", _liquidator);
    let visionAt = await ethers.getContractAt("Vision", _vision);

    // Initialize
    console.log("Initializing...");

    console.log("MasterVault init...");
    await masterVaultAt.changeProvider(_Provider, {nonce: _nonce}); _nonce += 1; console.log("1");

    console.log("DCol init...");
    await dColAt.changeMinter(_Provider, {nonce: _nonce}); _nonce += 1;

    console.log("Ledger init...");
    await ledgerAt.rely(gemJoinAt.address, {nonce: _nonce}); _nonce += 1; console.log("1")
    await ledgerAt.rely(_jail, {nonce: _nonce}); _nonce += 1; console.log("2")
    await ledgerAt["file(bytes32,bytes32,uint256)"](_ilk, ethers.utils.formatBytes32String("line"), _ledger_line + rad, {nonce: _nonce}); _nonce += 1; console.log("3")
    await ledgerAt["file(bytes32,bytes32,uint256)"](_ilk, ethers.utils.formatBytes32String("dust"), _ledger_dust + rad, {nonce: _nonce}); _nonce += 1; console.log("4")
    
    console.log("Vision init...");
    await visionAt["file(bytes32,bytes32,address)"](_ilk, ethers.utils.formatBytes32String("pip"), _collateralOracle, {nonce: _nonce}); _nonce += 1;

    console.log("Gemjoin init...");
    await gemJoinAt.rely(_interaction, {nonce: _nonce}); _nonce += 1;

    console.log("Liquidator init...");
    await liquidatorAt.rely(_jail, {nonce: _nonce}); _nonce += 1; console.log("1")
    await liquidatorAt["file(bytes32,bytes32,uint256)"](_ilk, ethers.utils.formatBytes32String("hole"), _liquidator_hole + rad, {nonce: _nonce}); _nonce += 1; console.log("2")
    await liquidatorAt["file(bytes32,bytes32,uint256)"](_ilk, ethers.utils.formatBytes32String("chop"), _liquidator_chop, {nonce: _nonce}); _nonce += 1; console.log("3")
    await liquidatorAt["file(bytes32,bytes32,address)"](_ilk, ethers.utils.formatBytes32String("jail"), _jail, {nonce: _nonce}); _nonce += 1; console.log("4")

    console.log("Jail init...");
    await jailAt.rely(_interaction, {nonce: _nonce}); _nonce += 1; console.log("1")
    await jailAt.rely(liquidatorAt.address, {nonce: _nonce}); _nonce += 1; console.log("2")
    await jailAt["file(bytes32,uint256)"](ethers.utils.formatBytes32String("buf"), _jail_buf, {nonce: _nonce}); _nonce += 1; console.log("3")// 10%
    await jailAt["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tail"), _jail_tail, {nonce: _nonce}); _nonce += 1; console.log("4")// 3H reset time
    await jailAt["file(bytes32,uint256)"](ethers.utils.formatBytes32String("cusp"), _jail_cusp, {nonce: _nonce}); _nonce += 1; console.log("5")// 60% reset ratio
    await jailAt["file(bytes32,uint256)"](ethers.utils.formatBytes32String("chip"), _jail_chip, {nonce: _nonce}); _nonce += 1; console.log("6")// 0.01% settlement incentive
    await jailAt["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tip"), _jail_tip + rad, {nonce: _nonce}); _nonce += 1; console.log("7")// 10$ flat incentive
    await jailAt["file(bytes32,uint256)"](ethers.utils.formatBytes32String("stopped"), _jail_stopped, {nonce: _nonce}); _nonce += 1; console.log("8")
    await jailAt["file(bytes32,address)"](ethers.utils.formatBytes32String("vision"), _vision, {nonce: _nonce}); _nonce += 1; console.log("9")
    await jailAt["file(bytes32,address)"](ethers.utils.formatBytes32String("liquidator"), liquidatorAt.address, {nonce: _nonce}); _nonce += 1; console.log("10")
    await jailAt["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), _settlement, {nonce: _nonce}); _nonce += 1; console.log("11")
    await jailAt["file(bytes32,address)"](ethers.utils.formatBytes32String("calc"), _decay, {nonce: _nonce}); _nonce += 1; console.log("12")

    console.log("Interaction init...");
    await interactionAttached.setProvider(_masterVault, _Provider, {nonce: _nonce}); _nonce += 1; console.log("1")
    await interactionAttached.setCollateralType(_masterVault, _gemJoin, _ilk, _jail, _mat, {nonce: _nonce}); _nonce += 1; console.log("2")
    await interactionAttached.poke(_masterVault, {nonce: _nonce, gasLimit: 3000000}); _nonce += 1; console.log("3")
    await interactionAttached.drip(_masterVault, {nonce: _nonce, gasLimit: 2000000}); _nonce += 1; console.log("4")
    await interactionAttached.setCollateralDuty(_masterVault, _fee_duty, {nonce: _nonce, gasLimit: 25000000}); _nonce += 1; console.log("5")

    console.log("Collateral Ready !!!");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
});