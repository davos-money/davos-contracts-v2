const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { joinSignature } = require('ethers/lib/utils');
const { ethers, network } = require('hardhat');
const Web3 = require('web3');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const DATA = "0x02";

describe('===Provider===', function () {
    let deployer, signer1, signer2, signer3, multisig;

    let Provider,
        collateralDerivative,
        masterVault,
        interaction;

    let _ilkCeMatic = ethers.utils.formatBytes32String("ceMATIC");
    let _dgtRewardsPoolLimitInEth = "100000000";
    let _multisig;

    let wad = "000000000000000000", // 18 Decimals
        ray = "000000000000000000000000000", // 27 Decimals
        rad = "000000000000000000000000000000000000000000000", // 45 Decimals
        ONE = 10 ** 27;


    let collateral = ethers.utils.formatBytes32String("aMATICc");

    beforeEach(async function () {

        ////////////////////////////////
        /** Deployments ------------ **/
        ////////////////////////////////

        [deployer, signer1, signer2, signer3, multisig] = await ethers.getSigners();
        _multisig = deployer.address;

        // Contract factory
        this.Token = await hre.ethers.getContractFactory("Token");
        this.DCol = await hre.ethers.getContractFactory("dCol");
        this.Provider = await hre.ethers.getContractFactory("Provider");
        this.Ledger = await hre.ethers.getContractFactory("Ledger");
        this.Vision = await hre.ethers.getContractFactory("Vision");
        this.Stablecoin = await hre.ethers.getContractFactory("Stablecoin");
        this.GemJoin = await hre.ethers.getContractFactory("GemJoin");
        this.StablecoinJoin = await hre.ethers.getContractFactory("StablecoinJoin");
        this.Oracle = await hre.ethers.getContractFactory("Oracle"); 
        this.Fee = await hre.ethers.getContractFactory("Fee");
        this.Settlement = await hre.ethers.getContractFactory("Settlement");
        this.Liquidator = await hre.ethers.getContractFactory("Liquidator");
        this.Jail = await hre.ethers.getContractFactory("Jail");
        this.Decay = await hre.ethers.getContractFactory("LinearDecrease");
        this.AuctionProxy = await hre.ethers.getContractFactory("AuctionProxy");
        this.PriceController = await hre.ethers.getContractFactory("PriceController");

        const auctionProxy = await this.AuctionProxy.deploy();
        await auctionProxy.deployed();
        this.Interaction = await hre.ethers.getContractFactory("Interaction", {
            unsafeAllow: ['external-library-linking'],
            libraries: {
                AuctionProxy: auctionProxy.address
            }
        });

        this.MasterVault = await hre.ethers.getContractFactory("MasterVault");
        this.Licensor = await hre.ethers.getContractFactory("Licensor");

        // Contract deployment
        collateralToken = await this.Token.deploy()
        await collateralToken.deployed();
        await collateralToken.initialize("Matic Token", "MTK");

        masterVault = await upgrades.deployProxy(this.MasterVault, ["MasterVault Token", "MVTK", collateralToken.address]);
        await masterVault.deployed();

        dCol = await upgrades.deployProxy(this.DCol, [], {initializer: "initialize"});
        await dCol.deployed();
        dColImp = await upgrades.erc1967.getImplementationAddress(dCol.address);

        decay = await upgrades.deployProxy(this.Decay, [], {initializer: "initialize"});
        await decay.deployed();
        decayImp = await upgrades.erc1967.getImplementationAddress(decay.address);

        oracle = await this.Oracle.deploy();
        await oracle.deployed();
        await oracle.setPrice("2" + wad); // 2$

        ledger = await upgrades.deployProxy(this.Ledger, [], {initializer: "initialize"});
        await ledger.deployed();
        ledgerImp = await upgrades.erc1967.getImplementationAddress(ledger.address);

        vision = await upgrades.deployProxy(this.Vision, [ledger.address], {initializer: "initialize"});
        await vision.deployed();
        visionImp = await upgrades.erc1967.getImplementationAddress(vision.address);

        stablecoin = await upgrades.deployProxy(this.Stablecoin, ["5", "STABLECOIN", "5000000" + wad], {initializer: "initialize"});
        await stablecoin.deployed();
        stablecoinImp = await upgrades.erc1967.getImplementationAddress(stablecoin.address);

        stablecoinJoin = await upgrades.deployProxy(this.StablecoinJoin, [ledger.address, stablecoin.address], {initializer: "initialize"});
        await stablecoinJoin.deployed();
        stablecoinJoinImp = await upgrades.erc1967.getImplementationAddress(stablecoinJoin.address);

        gemJoin = await upgrades.deployProxy(this.GemJoin, [ledger.address, _ilkCeMatic, masterVault.address], {initializer: "initialize"});
        await gemJoin.deployed();
        gemJoinImp = await upgrades.erc1967.getImplementationAddress(gemJoin.address);

        fee = await upgrades.deployProxy(this.Fee, [ledger.address], {initializer: "initialize"});
        await fee.deployed();
        feeImp = await upgrades.erc1967.getImplementationAddress(fee.address);

        settlement = await upgrades.deployProxy(this.Settlement, [ledger.address, stablecoinJoin.address, _multisig], {initializer: "initialize"});
        await settlement.deployed();
        settlementImp = await upgrades.erc1967.getImplementationAddress(settlement.address);

        liquidator = await upgrades.deployProxy(this.Liquidator, [ledger.address], {initializer: "initialize"});
        await liquidator.deployed();
        liquidatorImpl = await upgrades.erc1967.getImplementationAddress(liquidator.address);

        jail = await upgrades.deployProxy(this.Jail, [ledger.address, vision.address, liquidator.address, _ilkCeMatic], {initializer: "initialize"});
        await jail.deployed();
        jailImp = await upgrades.erc1967.getImplementationAddress(liquidator.address);

        interaction = await upgrades.deployProxy(this.Interaction, [ledger.address, vision.address, stablecoin.address, stablecoinJoin.address, fee.address, liquidator.address], 
            {
                initializer: "initialize",
                unsafeAllowLinkedLibraries: true
            }
        );
        await interaction.deployed();
        interactionImplAddress = await upgrades.erc1967.getImplementationAddress(interaction.address);

        Provider = await upgrades.deployProxy(this.Provider, [collateralToken.address, dCol.address, masterVault.address, interaction.address, false], {initializer: "initialize"});
        await Provider.deployed();

        priceController = await upgrades.deployProxy(this.PriceController, [], {initializer: "initialize"});

        licensor = await upgrades.deployProxy(this.Licensor, [deployer.address, 0, 0], {initializer: "initialize"});

        // initialize
        await ledger.rely(gemJoin.address);
        await ledger.rely(vision.address);
        await ledger.rely(stablecoinJoin.address);
        await ledger.rely(fee.address);
        await ledger.rely(liquidator.address);
        await ledger.rely(jail.address);
        await ledger.rely(interaction.address);
        await ledger["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Line"), "5000000" + rad);
        await ledger["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("line"), "5000000" + rad);
        await ledger["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("dust"), "100" + rad);
        
        await stablecoin.rely(stablecoinJoin.address);
        await stablecoin.setSupplyCap("5000000" + wad);
        
        await vision.rely(interaction.address);
        await vision["file(bytes32,bytes32,address)"](_ilkCeMatic, ethers.utils.formatBytes32String("pip"), oracle.address);
        await vision["file(bytes32,uint256)"](ethers.utils.formatBytes32String("par"), "1" + ray); // It means pegged to 1$
                
        await gemJoin.rely(interaction.address);
        await stablecoinJoin.rely(interaction.address);
        await stablecoinJoin.rely(settlement.address);
        await stablecoinJoin.rely(fee.address);

        await liquidator.rely(interaction.address);
        await liquidator.rely(jail.address);
        await liquidator["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), settlement.address);
        await liquidator["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Hole"), "50000000" + rad);
        await liquidator["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("hole"), "50000000" + rad);
        await liquidator["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("chop"), "1100000000000000000");
        await liquidator["file(bytes32,bytes32,address)"](_ilkCeMatic, ethers.utils.formatBytes32String("jail"), jail.address);
        
        await jail.rely(interaction.address);
        await jail.rely(liquidator.address);
        await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("buf"), "1100000000000000000000000000"); // 10%
        await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tail"), "10800"); // 3H reset time
        await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("cusp"), "600000000000000000000000000"); // 60% reset ratio
        await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("chip"), "100000000000000"); // 0.01% settlement incentive
        await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tip"), "10" + rad); // 10$ flat incentive
        await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("stopped"), "0");
        await jail["file(bytes32,address)"](ethers.utils.formatBytes32String("vision"), vision.address);
        await jail["file(bytes32,address)"](ethers.utils.formatBytes32String("liquidator"), liquidator.address);
        await jail["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), settlement.address);
        await jail["file(bytes32,address)"](ethers.utils.formatBytes32String("calc"), decay.address);
        
        await fee.rely(interaction.address);
        await fee["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), settlement.address);
        await fee["file(bytes32,address)"](ethers.utils.formatBytes32String("licensor"), licensor.address);
        await fee["file(bytes32,address)"](ethers.utils.formatBytes32String("stablecoinJoin"), stablecoinJoin.address);

        await settlement.rely(liquidator.address);
        await settlement["file(bytes32,address)"](ethers.utils.formatBytes32String("stablecoin"), stablecoin.address);
        
        await decay.connect(deployer)["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tau"), "36000"); // Price will reach 0 after this time

        await interaction.setCollateralType(masterVault.address, gemJoin.address, _ilkCeMatic, jail.address, "1333333333333333333333333333");
        await interaction.poke(masterVault.address);
        await interaction.drip(masterVault.address);
        await interaction.setProvider(masterVault.address, Provider.address);

        await masterVault.changeProvider(Provider.address);
        await dCol.changeMinter(Provider.address);
    });

    describe('--- Provide', function () {
        it('checks provide() functionality with ERC20', async function () {
            await collateralToken.approve(Provider.address, "1" + wad);
            await collateralToken.mint(deployer.address, "1" + wad);
            expect(await collateralToken.balanceOf(deployer.address)).to.be.equal("1" + wad);
            await Provider.provide("1" + wad);      
            expect(await collateralToken.balanceOf(deployer.address)).to.be.equal(0);
        });
        it('checks provide() functionality with Native', async function () {
            // Contract deployment
            collateralToken = await this.Token.deploy()
            await collateralToken.deployed();
            await collateralToken.initialize("Wrapped Matic", "wMATIC");

            masterVault = await upgrades.deployProxy(this.MasterVault, ["MasterVault Token", "MVTK", collateralToken.address]);
            await masterVault.deployed();

            dCol = await upgrades.deployProxy(this.DCol, [], {initializer: "initialize"});
            await dCol.deployed();
            dColImp = await upgrades.erc1967.getImplementationAddress(dCol.address);

            decay = await upgrades.deployProxy(this.Decay, [], {initializer: "initialize"});
            await decay.deployed();
            decayImp = await upgrades.erc1967.getImplementationAddress(decay.address);

            oracle = await this.Oracle.deploy();
            await oracle.deployed();
            await oracle.setPrice("2" + wad); // 2$

            ledger = await upgrades.deployProxy(this.Ledger, [], {initializer: "initialize"});
            await ledger.deployed();
            ledgerImp = await upgrades.erc1967.getImplementationAddress(ledger.address);

            vision = await upgrades.deployProxy(this.Vision, [ledger.address], {initializer: "initialize"});
            await vision.deployed();
            visionImp = await upgrades.erc1967.getImplementationAddress(vision.address);

            stablecoin = await upgrades.deployProxy(this.Stablecoin, ["5", "STABLECOIN", "5000000" + wad], {initializer: "initialize"});
            await stablecoin.deployed();
            stablecoinImp = await upgrades.erc1967.getImplementationAddress(stablecoin.address);

            stablecoinJoin = await upgrades.deployProxy(this.StablecoinJoin, [ledger.address, stablecoin.address], {initializer: "initialize"});
            await stablecoinJoin.deployed();
            stablecoinJoinImp = await upgrades.erc1967.getImplementationAddress(stablecoinJoin.address);

            gemJoin = await upgrades.deployProxy(this.GemJoin, [ledger.address, _ilkCeMatic, masterVault.address], {initializer: "initialize"});
            await gemJoin.deployed();
            gemJoinImp = await upgrades.erc1967.getImplementationAddress(gemJoin.address);

            fee = await upgrades.deployProxy(this.Fee, [ledger.address], {initializer: "initialize"});
            await fee.deployed();
            feeImp = await upgrades.erc1967.getImplementationAddress(fee.address);

            settlement = await upgrades.deployProxy(this.Settlement, [ledger.address, stablecoinJoin.address, _multisig], {initializer: "initialize"});
            await settlement.deployed();
            settlementImp = await upgrades.erc1967.getImplementationAddress(settlement.address);

            liquidator = await upgrades.deployProxy(this.Liquidator, [ledger.address], {initializer: "initialize"});
            await liquidator.deployed();
            liquidatorImpl = await upgrades.erc1967.getImplementationAddress(liquidator.address);

            jail = await upgrades.deployProxy(this.Jail, [ledger.address, vision.address, liquidator.address, _ilkCeMatic], {initializer: "initialize"});
            await jail.deployed();
            jailImp = await upgrades.erc1967.getImplementationAddress(liquidator.address);

            interaction = await upgrades.deployProxy(this.Interaction, [ledger.address, vision.address, stablecoin.address, stablecoinJoin.address, fee.address, liquidator.address], 
                {
                    initializer: "initialize",
                    unsafeAllowLinkedLibraries: true
                }
            );
            await interaction.deployed();
            interactionImplAddress = await upgrades.erc1967.getImplementationAddress(interaction.address);

            Provider = await upgrades.deployProxy(this.Provider, [collateralToken.address, dCol.address, masterVault.address, interaction.address, true], {initializer: "initialize"});
            await Provider.deployed();

            this.PriceController = await hre.ethers.getContractFactory("PriceController");
            this.Licensor = await hre.ethers.getContractFactory("Licensor");
            licensor = await upgrades.deployProxy(this.Licensor, [deployer.address, 0, 0], {initializer: "initialize"});

            // initialize
            await ledger.rely(gemJoin.address);
            await ledger.rely(vision.address);
            await ledger.rely(stablecoinJoin.address);
            await ledger.rely(fee.address);
            await ledger.rely(liquidator.address);
            await ledger.rely(jail.address);
            await ledger.rely(interaction.address);
            await ledger["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Line"), "5000000" + rad);
            await ledger["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("line"), "5000000" + rad);
            await ledger["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("dust"), "100" + rad);
            
            await stablecoin.rely(stablecoinJoin.address);
            await stablecoin.setSupplyCap("5000000" + wad);
            
            await vision.rely(interaction.address);
            await vision["file(bytes32,bytes32,address)"](_ilkCeMatic, ethers.utils.formatBytes32String("pip"), oracle.address);
            await vision["file(bytes32,uint256)"](ethers.utils.formatBytes32String("par"), "1" + ray); // It means pegged to 1$
                        
            await gemJoin.rely(interaction.address);
            await stablecoinJoin.rely(interaction.address);
            await stablecoinJoin.rely(settlement.address);
            
            await liquidator.rely(interaction.address);
            await liquidator.rely(jail.address);
            await liquidator["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), settlement.address);
            await liquidator["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Hole"), "50000000" + rad);
            await liquidator["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("hole"), "50000000" + rad);
            await liquidator["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("chop"), "1100000000000000000");
            await liquidator["file(bytes32,bytes32,address)"](_ilkCeMatic, ethers.utils.formatBytes32String("jail"), jail.address);
            
            await jail.rely(interaction.address);
            await jail.rely(liquidator.address);
            await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("buf"), "1100000000000000000000000000"); // 10%
            await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tail"), "10800"); // 3H reset time
            await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("cusp"), "600000000000000000000000000"); // 60% reset ratio
            await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("chip"), "100000000000000"); // 0.01% settlement incentive
            await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tip"), "10" + rad); // 10$ flat incentive
            await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("stopped"), "0");
            await jail["file(bytes32,address)"](ethers.utils.formatBytes32String("vision"), vision.address);
            await jail["file(bytes32,address)"](ethers.utils.formatBytes32String("liquidator"), liquidator.address);
            await jail["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), settlement.address);
            await jail["file(bytes32,address)"](ethers.utils.formatBytes32String("calc"), decay.address);
            
            await fee.rely(interaction.address);
            await fee["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), settlement.address);
            await fee["file(bytes32,address)"](ethers.utils.formatBytes32String("licensor"), licensor.address);
            await fee["file(bytes32,address)"](ethers.utils.formatBytes32String("stablecoinJoin"), stablecoinJoin.address);

            await settlement.rely(liquidator.address);
            await settlement["file(bytes32,address)"](ethers.utils.formatBytes32String("stablecoin"), stablecoin.address);
            
            await decay.connect(deployer)["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tau"), "36000"); // Price will reach 0 after this time

            await interaction.setCollateralType(masterVault.address, gemJoin.address, _ilkCeMatic, jail.address, "1333333333333333333333333333");
            await interaction.poke(masterVault.address);
            await interaction.drip(masterVault.address);
            await interaction.setProvider(masterVault.address, Provider.address);

            await masterVault.changeProvider(Provider.address);
            await dCol.changeMinter(Provider.address);

            await Provider.changeNativeStatus(true);

            expect(await collateralToken.balanceOf(masterVault.address)).to.be.equal(0);
            await expect(Provider.provide("2" + wad, {value: "1" + wad})).to.be.revertedWith("Provider/erc20-not-accepted");      
            await Provider.provide(0, {value: "1" + wad});      
            expect(await collateralToken.balanceOf(masterVault.address)).to.be.equal("1" + wad);
        });
    });
    describe('--- Release', function () {
        it('reverts: recipient is 0 address', async function () {
            await collateralToken.approve(Provider.address, "1" + wad);
            await collateralToken.mint(deployer.address, "1" + wad);
            await Provider.provide("1" + wad);      

            await expect(Provider.release(NULL_ADDRESS, "1" + wad)).to.be.revertedWith("");
        });
        it('checks release() functionality', async function () {
            await collateralToken.approve(Provider.address, "1" + wad);
            await collateralToken.mint(deployer.address, "1" + wad);
            await Provider.provide("1" + wad);      

            await Provider.release(deployer.address, "1" + wad);
        });
    });
    describe('--- Pause and Unpause', function () {
        it('pauses the contract', async function () {
            await Provider.pause();      
            expect(await Provider.paused()).to.be.equal(true);
        });
        it('unpauses the contract', async function () {
            await Provider.pause();      
            await Provider.unPause();      
            expect(await Provider.paused()).to.be.equal(false);
        });
    });
    describe('--- Setters', function () {
        it('Change underlying token', async function () {
            let newAddress = await this.Token.deploy(); 
            await newAddress.deployed();
            await Provider.changeUnderlying(newAddress.address);      
            expect(await Provider.underlying()).to.be.equal(newAddress.address);
        });
        it('Change collateral', async function () {
            let newAddress = await this.Token.deploy(); 
            await newAddress.deployed();
            await Provider.changeCollateral(newAddress.address);      
            expect(await Provider.collateral()).to.be.equal(newAddress.address);
        });
        it('Change collateralDerivative', async function () {
            let newAddress = await this.Token.deploy(); 
            await newAddress.deployed();
            await Provider.changeCollateralDerivative(newAddress.address);      
            expect(await Provider.collateralDerivative()).to.be.equal(newAddress.address);
        });
        it('Change masterVault', async function () {
            let newAddress = await this.Token.deploy(); 
            await newAddress.deployed();
            await Provider.changeMasterVault(newAddress.address);      
            expect(await Provider.masterVault()).to.be.equal(newAddress.address);
        });
        it('Change interaction', async function () {
            let newAddress = await this.Token.deploy(); 
            await newAddress.deployed();
            await Provider.changeInteraction(newAddress.address);      
            expect(await Provider.interaction()).to.be.equal(newAddress.address);
        });
    });
    describe('--- OnlyOwnerOrInteraction', function () {
        it('reverts: not owner or interaction', async function () {
            await expect(Provider.connect(signer3).liquidation(deployer.address, "1")).to.be.revertedWith("Provider/not-interaction-or-owner");
        });
        it('reverts: 0 address liquidation', async function () {
            await expect(Provider.liquidation(NULL_ADDRESS, "1")).to.be.revertedWith("");
        });
        it('reverts: 0 address mint', async function () {
            await expect(Provider.daoMint(NULL_ADDRESS, "1")).to.be.revertedWith("");
        });
        it('reverts: 0 address burn', async function () {
            await expect(Provider.daoBurn(NULL_ADDRESS, "1")).to.be.revertedWith("");
        });
        it('mints dCol', async function () {
            await Provider.daoMint(deployer.address, "1");
            expect(await dCol.balanceOf(deployer.address)).to.be.equal("1");
        });
        it('burns dCol', async function () {
            await Provider.daoMint(deployer.address, "1");
            expect(await dCol.balanceOf(deployer.address)).to.be.equal("1");

            await Provider.daoBurn(deployer.address, "1");
            expect(await dCol.balanceOf(deployer.address)).to.be.equal("0");
        });
    });
});