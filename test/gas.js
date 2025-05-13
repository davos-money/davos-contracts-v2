const { ethers } = require('hardhat');
const TransparentUpgradeableProxy = require("@openzeppelin/upgrades-core/artifacts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json");
const ProxyAdmin = require("@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json");
const ether = require('@openzeppelin/test-helpers/src/ether');

let wad = "000000000000000000", // 18 Decimals
    ray = "000000000000000000000000000", // 27 Decimals
    rad = "000000000000000000000000000000000000000000000"; // 45 Decimals

describe('===Gas Calculation===', function () {
    let deployer;

    beforeEach(async function () {
        [deployer, _multisig] = await ethers.getSigners();
    });

    describe('--- calculate()', function () {
        it('calculates: gasCost', async function () {

            var total = Number(0);

            this.Ledger = await ethers.getContractFactory("Ledger");
            this.Vision = await ethers.getContractFactory("Vision");
            this.Stablecoin = await ethers.getContractFactory("Stablecoin");
            this.StablecoinJoin = await ethers.getContractFactory("StablecoinJoin");
            this.Fee = await ethers.getContractFactory("Fee");
            this.Settlement = await ethers.getContractFactory("Settlement");
            this.Liquidator = await ethers.getContractFactory("Liquidator");
            this.Decay = await ethers.getContractFactory("LinearDecrease");

            this.PA = await hre.ethers.getContractFactory(ProxyAdmin.abi, ProxyAdmin.bytecode);
            this.TUP = await hre.ethers.getContractFactory(TransparentUpgradeableProxy.abi, TransparentUpgradeableProxy.bytecode);

            this.AuctionProxy = await hre.ethers.getContractFactory("AuctionProxy");
            const auctionProxy = await this.AuctionProxy.deploy();
            this.Interaction = await hre.ethers.getContractFactory("Interaction", {
                unsafeAllow: ['external-library-linking'],
                libraries: {
                    AuctionProxy: auctionProxy.address
                }
            });

            this.MasterVault = await ethers.getContractFactory("MasterVault");
            this.Provider = await ethers.getContractFactory("Provider");
            this.DCol = await ethers.getContractFactory("dCol");
            this.GemJoin = await ethers.getContractFactory("GemJoin");
            this.Jail = await ethers.getContractFactory("Jail");

            this.PriceController = await ethers.getContractFactory("PriceController");
            
            this.Oracle = await ethers.getContractFactory("CollateralOracle");

            this.WAToken = await ethers.getContractFactory("WAToken");

            let ledgerImp = await this.Ledger.deploy();
            let visionImp = await this.Vision.deploy();
            let stablecoinImp = await this.Stablecoin.deploy();
            let stablecoinJoinImp = await this.StablecoinJoin.deploy();
            let feeImp = await this.Fee.deploy();
            let settlementImp = await this.Settlement.deploy();
            let liquidatorImp = await this.Liquidator.deploy();
            let decayImp = await this.Decay.deploy();

            total += Number(ledgerImp.deployTransaction.gasLimit);
            total += Number(visionImp.deployTransaction.gasLimit);
            total += Number(stablecoinImp.deployTransaction.gasLimit);
            total += Number(stablecoinJoinImp.deployTransaction.gasLimit);
            total += Number(feeImp.deployTransaction.gasLimit);
            total += Number(settlementImp.deployTransaction.gasLimit);
            total += Number(liquidatorImp.deployTransaction.gasLimit);
            total += Number(decayImp.deployTransaction.gasLimit);

            console.log("Ledger---------------------------------" + ledgerImp.deployTransaction.gasLimit)
            console.log("Vision--------------------------------" + visionImp.deployTransaction.gasLimit)
            console.log("Stablecoin-------------------------------" + stablecoinImp.deployTransaction.gasLimit)
            console.log("DJoin-------------------------------" + stablecoinJoinImp.deployTransaction.gasLimit)
            console.log("Fee---------------------------------" + feeImp.deployTransaction.gasLimit)
            console.log("Settlement---------------------------------" + settlementImp.deployTransaction.gasLimit)
            console.log("Liquidator---------------------------------" + liquidatorImp.deployTransaction.gasLimit)
            console.log("Aba---------------------------------" + decayImp.deployTransaction.gasLimit)
            console.log("TOTAL-------------------------------" + total);

            // Proxy Admin
            let proxyAdmin = await this.PA.deploy();
            console.log("ProxyAdmin--------------------------" + proxyAdmin.deployTransaction.gasLimit)
            total += Number(proxyAdmin.deployTransaction.gasLimit);
            console.log("TOTAL-------------------------------" + total);

            // Logic, Admin, Data
            let ledger = await this.TUP.deploy(ledgerImp.address, proxyAdmin.address, "0x");
            let vision = await this.TUP.deploy(visionImp.address, proxyAdmin.address, "0x");
            let stablecoin = await this.TUP.deploy(stablecoinImp.address, proxyAdmin.address, "0x");
            let stablecoinJoin = await this.TUP.deploy(stablecoinJoinImp.address, proxyAdmin.address, "0x");
            let fee = await this.TUP.deploy(feeImp.address, proxyAdmin.address, "0x");
            let settlement = await this.TUP.deploy(settlementImp.address, proxyAdmin.address, "0x");
            let liquidator = await this.TUP.deploy(liquidatorImp.address, proxyAdmin.address, "0x");
            let decay = await this.TUP.deploy(decayImp.address, proxyAdmin.address, "0x");

            total += Number(ledger.deployTransaction.gasLimit) * 8;
            console.log("8 Proxies---------------------------" + Number(ledger.deployTransaction.gasLimit)*8)
            console.log("TOTAL-------------------------------" + total)

            let interactionImp = await this.Interaction.deploy();
            total += Number(auctionProxy.deployTransaction.gasLimit)
            total += Number(interactionImp.deployTransaction.gasLimit)

            console.log("AuctionProxy------------------------" + auctionProxy.deployTransaction.gasLimit)
            console.log("Interaction-------------------------" + interactionImp.deployTransaction.gasLimit)
            console.log("TOTAL-------------------------------" + total);

            let interaction = await this.TUP.deploy(interactionImp.address, proxyAdmin.address, "0x");

            total += Number(ledger.deployTransaction.gasLimit) * 2;
            console.log("2 Proxies---------------------------" + Number(ledger.deployTransaction.gasLimit)*2)
            console.log("TOTAL-------------------------------" + total);

            ledger = await ethers.getContractAt("Ledger", ledger.address);
            vision = await ethers.getContractAt("Vision", vision.address);
            stablecoin = await ethers.getContractAt("Stablecoin", stablecoin.address);
            stablecoinJoin = await ethers.getContractAt("StablecoinJoin", stablecoinJoin.address);
            fee = await ethers.getContractAt("Fee", fee.address);
            settlement = await ethers.getContractAt("Settlement", settlement.address);
            liquidator = await ethers.getContractAt("Liquidator", liquidator.address);
            decay = await ethers.getContractAt("LinearDecrease", decay.address);
            interaction = await ethers.getContractAt("Interaction", interaction.address);

            let receipt;
            receipt = await (await ledger.initialize()).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await vision.initialize(ledger.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await stablecoin.initialize(1, "Stablecoin", "5000000" + wad)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await stablecoinJoin.initialize(ledger.address, stablecoin.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await fee.initialize(ledger.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await settlement.initialize(ledger.address, stablecoinJoin.address, deployer.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await liquidator.initialize(ledger.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await decay.initialize()).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await interaction.initialize(ledger.address, vision.address, stablecoin.address, stablecoinJoin.address, fee.address, liquidator.address)).wait(); total += Number(receipt.cumulativeGasUsed);

            receipt = await (await ledger.rely(vision.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await ledger.rely(stablecoinJoin.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await ledger.rely(fee.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await ledger.rely(liquidator.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await ledger.rely(interaction.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await ledger["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Line"), 5000000 + rad)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await stablecoin.rely(stablecoinJoin.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await stablecoin.setSupplyCap("5000000" + wad)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await vision.rely(interaction.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await vision["file(bytes32,uint256)"](ethers.utils.formatBytes32String("par"), 1 + ray)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await stablecoinJoin.rely(interaction.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await stablecoinJoin.rely(settlement.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await liquidator.rely(interaction.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await liquidator["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), settlement.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await liquidator["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Hole"), 50000000 + rad)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await fee.rely(interaction.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await fee["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), settlement.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await settlement.rely(liquidator.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await settlement["file(bytes32,address)"](ethers.utils.formatBytes32String("stablecoin"), stablecoin.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await decay.connect(deployer)["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tau"), 36000)).wait(); total += Number(receipt.cumulativeGasUsed);

            console.log("TOTAL ALL INITIALIZE ---------------" + total);

            receipt = await (await interaction.rely(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await ledger.rely(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await vision.rely(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await stablecoin.rely(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await stablecoinJoin.rely(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await fee.rely(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await settlement.rely(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await liquidator.rely(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await decay.rely(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);

            proxyAdmin = await ethers.getContractAt(["function transferOwnership(address) external"], proxyAdmin.address);
            receipt = await (await proxyAdmin.transferOwnership(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);

            console.log("TOTAL ALL TRANSFERS ----------------" + total);

            let masterVaultImp = await this.MasterVault.deploy();
            let ProviderImp = await this.Provider.deploy();
            let dColImp = await this.DCol.deploy();
            let gemJoinImp = await this.GemJoin.deploy();
            let jailImp = await this.Jail.deploy();
            let priceControllerImp = await this.PriceController.deploy();
            let oracleImp = await this.Oracle.deploy();
            let wATokenImp = await this.WAToken.deploy();

            total += Number(masterVaultImp.deployTransaction.gasLimit);
            total += Number(ProviderImp.deployTransaction.gasLimit);
            total += Number(dColImp.deployTransaction.gasLimit);
            total += Number(gemJoinImp.deployTransaction.gasLimit);
            total += Number(jailImp.deployTransaction.gasLimit);
            total += Number(priceControllerImp.deployTransaction.gasLimit);
            total += Number(oracleImp.deployTransaction.gasLimit);
            total += Number(wATokenImp.deployTransaction.gasLimit);

            console.log("MasterVault-------------------------" + masterVaultImp.deployTransaction.gasLimit)
            console.log("Provider-----------------------" + ProviderImp.deployTransaction.gasLimit)
            console.log("DCol--------------------------------" + dColImp.deployTransaction.gasLimit)
            console.log("GemJoin-----------------------------" + gemJoinImp.deployTransaction.gasLimit)
            console.log("Jail-----------------------------" + jailImp.deployTransaction.gasLimit)
            console.log("PriceController------------------------" + priceControllerImp.deployTransaction.gasLimit)
            console.log("Oracle------------------------------" + oracleImp.deployTransaction.gasLimit)
            console.log("Wrapper-----------------------------" + wATokenImp.deployTransaction.gasLimit)
            console.log("TOTAL-------------------------------" + total);

            // Proxy Admin
            proxyAdmin = await this.PA.deploy();
            console.log("ProxyAdmin--------------------------" + proxyAdmin.deployTransaction.gasLimit)
            total += Number(proxyAdmin.deployTransaction.gasLimit);
            console.log("TOTAL-------------------------------" + total);

            // Logic, Admin, Data
            let masterVault = await this.TUP.deploy(masterVaultImp.address, proxyAdmin.address, "0x");
            let Provider = await this.TUP.deploy(ProviderImp.address, proxyAdmin.address, "0x");
            let dCol = await this.TUP.deploy(dColImp.address, proxyAdmin.address, "0x");
            let gemJoin = await this.TUP.deploy(gemJoinImp.address, proxyAdmin.address, "0x");
            let jail = await this.TUP.deploy(jailImp.address, proxyAdmin.address, "0x");
            let priceController = await this.TUP.deploy(priceControllerImp.address, proxyAdmin.address, "0x");
            let oracle = await this.TUP.deploy(oracleImp.address, proxyAdmin.address, "0x");
            let wAToken = await this.TUP.deploy(wATokenImp.address, proxyAdmin.address, "0x");

            total += Number(masterVault.deployTransaction.gasLimit) * 8;
            console.log("8 Proxies---------------------------" + Number(masterVault.deployTransaction.gasLimit)*8)
            console.log("TOTAL-------------------------------" + total)

            masterVault = await ethers.getContractAt("MasterVault", masterVault.address);
            Provider = await ethers.getContractAt("Provider", Provider.address);
            dCol = await ethers.getContractAt("dCol", dCol.address);
            gemJoin = await ethers.getContractAt("GemJoin", gemJoin.address);
            jail = await ethers.getContractAt("Jail", jail.address);
            priceController = await ethers.getContractAt("PriceController", priceController.address);
            oracle = await ethers.getContractAt("CollateralOracle", oracle.address);
            wAToken = await ethers.getContractAt("WAToken", wAToken.address);

            // TEMP
            let _underlying = (await this.Stablecoin.deploy()).address;
            let _ilk = ethers.utils.formatBytes32String("TEMP");

            receipt = await (await masterVault.initialize("MasterVault Token", "MVT", wAToken.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await Provider.initialize(wAToken.address, dCol.address, masterVault.address, interaction.address, false)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await dCol.initialize()).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await gemJoin.initialize(ledger.address, _ilk, masterVault.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await jail.initialize(ledger.address, vision.address, liquidator.address, _ilk)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await priceController.initialize()).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await oracle.initialize("0x73AB44615772a0d31dB48A87d7F4F81a3601BceB", wAToken.address, masterVault.address, priceController.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            receipt = await (await wAToken.initialize("abc", "ABC", _underlying)).wait(); total += Number(receipt.cumulativeGasUsed);

            await ( await priceController.setToken(wAToken.address, "convertToAssets(uint256)", "convertToShares(uint256)", "", false)).wait(); total += Number(receipt.cumulativeGasUsed); 

            await ( await masterVault.changeProvider(Provider.address)).wait(); total += Number(receipt.cumulativeGasUsed); 

            await ( await dCol.changeMinter(Provider.address)).wait(); total += Number(receipt.cumulativeGasUsed); 

            await ( await ledger.rely(gemJoin.address)).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await ledger.rely(jail.address)).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await ledger["file(bytes32,bytes32,uint256)"](_ilk, ethers.utils.formatBytes32String("line"), "5000000" + rad)).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await ledger["file(bytes32,bytes32,uint256)"](_ilk, ethers.utils.formatBytes32String("dust"), "1" + rad)).wait(); total += Number(receipt.cumulativeGasUsed); 
            
            await ( await vision["file(bytes32,bytes32,address)"](_ilk, ethers.utils.formatBytes32String("pip"), oracle.address)).wait(); total += Number(receipt.cumulativeGasUsed); 

            await ( await gemJoin.rely("0x925BEDd155c21B673bfD9F00e0eA23dd85d70186")).wait(); total += Number(receipt.cumulativeGasUsed); 

            await ( await liquidator.rely(jail.address)).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await liquidator["file(bytes32,bytes32,uint256)"](_ilk, ethers.utils.formatBytes32String("hole"), "50000000" + rad)).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await liquidator["file(bytes32,bytes32,uint256)"](_ilk, ethers.utils.formatBytes32String("chop"), "1100000000000000000")).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await liquidator["file(bytes32,bytes32,address)"](_ilk, ethers.utils.formatBytes32String("jail"), jail.address)).wait(); total += Number(receipt.cumulativeGasUsed); 

            await ( await jail.rely("0x925BEDd155c21B673bfD9F00e0eA23dd85d70186")).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await jail.rely("0xc9069E47C72C0c54F473Ca44691cF64e5C95a823")).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("buf"), "1100000000000000000000000000")).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tail"), "10800")).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("cusp"), "600000000000000000000000000")).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("chip"), "100000000000000")).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tip"), "10" + rad)).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("stopped"), "0")).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await jail["file(bytes32,address)"](ethers.utils.formatBytes32String("vision"), "0x9032bDa78d8fCe219fB0E95b69E54047921BB816")).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await jail["file(bytes32,address)"](ethers.utils.formatBytes32String("liquidator"), "0xc9069E47C72C0c54F473Ca44691cF64e5C95a823")).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await jail["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), "0x7B0E879f4860767d5e2455591Ba025978ab3461F")).wait(); total += Number(receipt.cumulativeGasUsed); 
            await ( await jail["file(bytes32,address)"](ethers.utils.formatBytes32String("calc"), "0x5bF6C2a5dF522FeD9FaA17AA280510b4F78163E6")).wait(); total += Number(receipt.cumulativeGasUsed); 

            licensor = await hre.ethers.getContractFactory("Licensor");
            licensor = await upgrades.deployProxy(licensor, [deployer.address, 0, 0], {initializer: "initialize"});
            await fee["file(bytes32,address)"](ethers.utils.formatBytes32String("licensor"), licensor.address);
            await fee["file(bytes32,address)"](ethers.utils.formatBytes32String("stablecoinJoin"), stablecoinJoin.address);

            await ( await interaction.setProvider(masterVault.address, Provider.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            await ( await interaction.setCollateralType(masterVault.address, gemJoin.address, _ilk, jail.address, "1515151515151515151515151515")).wait(); total += Number(receipt.cumulativeGasUsed);
            // await ( await interaction.poke(masterVault.address, {gasLimit: 3000000})).wait(); total += Number(receipt.cumulativeGasUsed);
            await ( await interaction.drip(masterVault.address, {gasLimit: 2000000})).wait(); total += Number(receipt.cumulativeGasUsed);
            await ( await interaction.setCollateralDuty(masterVault.address, "1000000001622535724756171270", {gasLimit: 25000000})).wait(); total += Number(receipt.cumulativeGasUsed);

            console.log("TOTAL COLLATERAL ALL INITIALIZE-----" + total);

            await ( await priceController.transferOwnership(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            await ( await wAToken.transferOwnership(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            await ( await masterVault.transferOwnership(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            await ( await Provider.transferOwnership(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            await ( await dCol.transferOwnership(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            await ( await gemJoin.rely(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);
            await ( await jail.rely(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);

            proxyAdmin = await ethers.getContractAt(["function transferOwnership(address) external"], proxyAdmin.address);
            receipt = await (await proxyAdmin.transferOwnership(_multisig.address)).wait(); total += Number(receipt.cumulativeGasUsed);

            console.log("TOTAL COLLATERAL ALL TRANSFER-------" + total);
        });
    });
});