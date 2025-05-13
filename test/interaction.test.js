const {ethers, upgrades} = require("hardhat");
const { expect, assert } = require("chai");
const { ether } = require("@openzeppelin/test-helpers");
const { parseEther } = ethers.utils;
const NetworkSnapshotter = require("./helpers/networkSnapshotter");

const {
    toWad,
    toRay,
    advanceTime,
} = require("./helpers/utils");
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const NULL_ILK = '0x0000000000000000000000000000000000000000000000000000000000000000';

describe("Interaction", function () {

    let collateral, _chainId, _mat, _dgtRewardsPoolLimitInEth, _ledger_Line, _ledger_line,
        _vision_par, _liquidator_Hole, _liquidator_hole, _liquidator_chop, _decay_tau, _jail_buf, _jail_tail,
        _jail_cusp, _jail_chip, _jail_tip, _jail_stopped, _multisig, _ledger_dust, dCol;
        
    async function deploySwapPool() {
        const { MaxUint256 } = ethers.constants;
        const mintAmount = parseEther("10000000");
        const addAmount = parseEther("30");
    
        [deployer, user1] = await ethers.getSigners();
    
        const WNativeFactory = await ethers.getContractFactory("Token");
        const CerosTokenFactory = await ethers.getContractFactory("Token");
    
        wNative = await WNativeFactory.connect(deployer).deploy();
        await wNative.deployed();
        cerosToken = await CerosTokenFactory.connect(deployer).deploy();
        await cerosToken.deployed();
    
        await wNative.mint(user1.address, mintAmount);
        await cerosToken.mint(user1.address, mintAmount);
    
        await cerosToken.setRatio(parseEther("0.6"));
        
        // Initialize Contracts
        return [wNative, cerosToken];
    } 

    const networkSnapshotter = new NetworkSnapshotter();

    async function init() {

        _mat = "1333333333333333333333333333";
        _dgtRewardsPoolLimitInEth = "100000000";
        _ledger_Line = "5000000";
        _ledger_line = "5000000";
        _ledger_dust = "100";
        _vision_par = "1";
        _liquidator_Hole = "50000000";
        _liquidator_hole = "50000000";
        _liquidator_chop = "1100000000000000000";
        _decay_tau = "36000";
        _jail_buf = "1100000000000000000000000000";
        _jail_tail = "10800";
        _jail_cusp = "600000000000000000000000000";
        _jail_chip = "100000000000000";
        _jail_tip = "10";
        _jail_stopped = "0";
        _chainId = "97";

        collateral = ethers.utils.formatBytes32String("aMATICc");

        wad = "000000000000000000", // 18 Decimals
        ray = "000000000000000000000000000", // 27 Decimals
        rad = "000000000000000000000000000000000000000000000", // 45 Decimals
        ONE = 10 ** 27;
        YEAR = 31556952;

        // Signer
        [deployer] = await ethers.getSigners();
        _multisig = deployer.address;

        [wMatic, aMaticc] = await deploySwapPool();
        collateralToken = aMaticc;

        _ilkCeMatic = ethers.utils.formatBytes32String("aMATICc");

        // Contracts Fetching
        AMATICc = await ethers.getContractFactory("Token");
        DCol = await ethers.getContractFactory("dCol");
        Provider = await ethers.getContractFactory("Provider");
        Ledger = await ethers.getContractFactory("Ledger");
        Vision = await ethers.getContractFactory("Vision");
        Stablecoin = await ethers.getContractFactory("Stablecoin");
        GemJoin = await ethers.getContractFactory("GemJoin");
        StablecoinJoin = await ethers.getContractFactory("StablecoinJoin");
        Oracle = await ethers.getContractFactory("Oracle"); 
        Fee = await ethers.getContractFactory("Fee");
        Settlement = await ethers.getContractFactory("Settlement");
        Liquidator = await ethers.getContractFactory("Liquidator");
        Jail = await ethers.getContractFactory("Jail");
        Decay = await ethers.getContractFactory("LinearDecrease");
        AuctionProxy = await ethers.getContractFactory("AuctionProxy");

        const auctionProxy = await this.AuctionProxy.deploy();
        await auctionProxy.deployed();
        Interaction = await ethers.getContractFactory("Interaction", {
            unsafeAllow: ['external-library-linking'],
            libraries: {
                AuctionProxy: auctionProxy.address
            }
        });

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

        stablecoin = await upgrades.deployProxy(this.Stablecoin, [_chainId, "STABLECOIN", "5000000" + wad], {initializer: "initialize"});
        await stablecoin.deployed();
        stablecoinImp = await upgrades.erc1967.getImplementationAddress(stablecoin.address);

        stablecoinJoin = await upgrades.deployProxy(this.StablecoinJoin, [ledger.address, stablecoin.address], {initializer: "initialize"});
        await stablecoinJoin.deployed();
        stablecoinJoinImp = await upgrades.erc1967.getImplementationAddress(stablecoinJoin.address);

        gemJoin = await upgrades.deployProxy(this.GemJoin, [ledger.address, _ilkCeMatic, collateralToken.address], {initializer: "initialize"});
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
                unsafeAllowLinkedLibraries: true,
            }
        );
        await interaction.deployed();
        interactionImplAddress = await upgrades.erc1967.getImplementationAddress(interaction.address);

        licensor = await hre.ethers.getContractFactory("Licensor");
        licensor = await upgrades.deployProxy(licensor, [deployer.address, 0, 0], {initializer: "initialize"});

        Provider = await upgrades.deployProxy(this.Provider, [collateralToken.address, dCol.address, collateralToken.address, interaction.address, false], {initializer: "initialize"});
        await Provider.deployed();
        ProviderImplementation = await upgrades.erc1967.getImplementationAddress(Provider.address);

        await ledger.rely(gemJoin.address);
        await ledger.rely(vision.address);
        await ledger.rely(stablecoinJoin.address);
        await ledger.rely(fee.address);
        await ledger.rely(liquidator.address);
        await ledger.rely(jail.address);
        await ledger.rely(interaction.address);
        await ledger["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Line"), _ledger_Line + rad);
        await ledger["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("line"), _ledger_line + rad);
        await ledger["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("dust"), _ledger_dust + rad);
        
        await stablecoin.rely(stablecoinJoin.address);
        await stablecoin.setSupplyCap("5000000" + wad);
        
        await vision.rely(interaction.address);
        await vision["file(bytes32,bytes32,address)"](_ilkCeMatic, ethers.utils.formatBytes32String("pip"), oracle.address);
        await vision["file(bytes32,uint256)"](ethers.utils.formatBytes32String("par"), _vision_par + ray); // It means pegged to 1$

        await gemJoin.rely(interaction.address);
        await stablecoinJoin.rely(interaction.address);
        await stablecoinJoin.rely(settlement.address);
        
        await liquidator.rely(interaction.address);
        await liquidator.rely(jail.address);
        await liquidator["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), settlement.address);
        await liquidator["file(bytes32,uint256)"](ethers.utils.formatBytes32String("Hole"), _liquidator_Hole + rad);
        await liquidator["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("hole"), _liquidator_hole + rad);
        await liquidator["file(bytes32,bytes32,uint256)"](_ilkCeMatic, ethers.utils.formatBytes32String("chop"), _liquidator_chop);
        await liquidator["file(bytes32,bytes32,address)"](_ilkCeMatic, ethers.utils.formatBytes32String("jail"), jail.address);
        
        await jail.rely(interaction.address);
        await jail.rely(liquidator.address);
        await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("buf"), _jail_buf); // 10%
        await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tail"), _jail_tail); // 3H reset time
        await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("cusp"), _jail_cusp); // 60% reset ratio
        await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("chip"), _jail_chip); // 0.01% settlement incentive
        await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tip"), _jail_tip + rad); // 10$ flat incentive
        await jail["file(bytes32,uint256)"](ethers.utils.formatBytes32String("stopped"), _jail_stopped);
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
        
        await decay.connect(deployer)["file(bytes32,uint256)"](ethers.utils.formatBytes32String("tau"), _decay_tau); // Price will reach 0 after this time
    }

    async function setCollateralType() {
        await interaction.setCollateralType(collateralToken.address, gemJoin.address, _ilkCeMatic, jail.address, _mat);
        await interaction.poke(collateralToken.address);
        await interaction.drip(collateralToken.address);
    }
    
    before(async function () {
        [deployer, signer1, signer2, signer3] = await ethers.getSigners();
        await init();
        await networkSnapshotter.firstSnapshot();
    });

    afterEach("revert", async () => await networkSnapshotter.revert());
    
    describe('Basic functionality', async () => {
        it("revert:: whitelist: only authorized account can enable whitelist", async function () {
            await expect(
                interaction
                .connect(signer1)
                .enableWhitelist()
            ).to.be.revertedWith("Interaction/not-authorized");
        });

        it("whitelist: should let authorized account enable whitelist", async function () {
            await interaction.connect(deployer).enableWhitelist();
            const whitelistMode = await interaction.whitelistMode();
            assert.equal(whitelistMode, 1);
        });

        it("revert:: deposit(): cannot deposit collateral for inactive collateral type", async function () {
            const depositAmount = parseEther("1");
            await aMaticc.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256)
            await expect(
                interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                depositAmount
            )).to.be.revertedWith("Interaction/inactive-collateral");
        });

        it("deposit(): should let user deposit collateral", async function () {
            await setCollateralType();
            const depositAmount = parseEther("1");
            await aMaticc.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256);
            
            await expect(interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
            )).to.be.revertedWith("Interaction/too-much-requested");

            await expect(
            tx = await interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                depositAmount
            )).to.emit(interaction, "Deposit")
            .withArgs(signer1.address, collateralToken.address, depositAmount, depositAmount);
            const deposits = await interaction.deposits(aMaticc.address);
            expect(deposits).eq(depositAmount);
        });

        it("reverts: borrow 0 amount", async function () {
            await expect(interaction.borrow(aMaticc.address, 0)).to.be.revertedWith("Interaction/inactive-collateral");
        });

        it("revert:: deposit(): only whitelisted account can deposit", async function () {
            await interaction.connect(deployer).enableWhitelist();
            await setCollateralType();
            const depositAmount = parseEther("1");
            await aMaticc.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256)
            await expect(
                interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                depositAmount
            )).to.be.revertedWith("Interaction/not-in-whitelist");
        });

        it("revert:: deposit(): should not let user deposit collateral directly to interaction", async function () {
            await setCollateralType();
            await interaction.setProvider(collateralToken.address, Provider.address)
            const depositAmount = parseEther("1");
            await aMaticc.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256)
            await expect(
                interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                depositAmount
            )).to.be.revertedWith("Interaction/only stablecoin provider can deposit for this token");
        });

        it("withdraw(): should let user withdraw", async function () {
            await setCollateralType();
            const depositAmount = parseEther("1");
            const withdrawAmount = parseEther("0.5");
            await aMaticc.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256)
            await expect(
                interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                depositAmount
            )).to.emit(interaction, "Deposit")
            .withArgs(signer1.address, collateralToken.address, depositAmount, depositAmount);
            const depositsBefore = await interaction.deposits(aMaticc.address);
            expect(depositsBefore).eq(depositAmount);
            
            await expect(
                interaction.connect(signer1).withdraw(
                signer1.address,
                aMaticc.address,
                withdrawAmount
            )).to.emit(interaction, "Withdraw")
            .withArgs(signer1.address, withdrawAmount);
            depositsAfter = await interaction.deposits(aMaticc.address);
            assert.equal(depositsAfter, depositsBefore - withdrawAmount); 
        });

        it("revert:: withdraw(): Caller must be the same address as participant(!Provider)", async function () {
            await setCollateralType();
            const depositAmount = parseEther("1");
            const withdrawAmount = parseEther("0.5");
            await aMaticc.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256)
            await expect(
                interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                depositAmount
            )).to.emit(interaction, "Deposit")
            .withArgs(signer1.address, collateralToken.address, depositAmount, depositAmount);
            const depositsBefore = await interaction.deposits(aMaticc.address);
            expect(depositsBefore).eq(depositAmount);
            
            await expect(
                interaction.connect(signer2).withdraw(
                signer1.address,
                aMaticc.address,
                withdrawAmount
            )).to.be.revertedWith("Interaction/Caller must be the same address as participant");
        });

        it("revert:: withdraw(): Caller must be the same address as participant(!Provider)", async function () {
            await setCollateralType();
            const depositAmount = parseEther("1");
            const withdrawAmount = parseEther("0.5");
            await aMaticc.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256)
            await expect(
                interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                depositAmount
            )).to.emit(interaction, "Deposit")
            .withArgs(signer1.address, collateralToken.address, depositAmount, depositAmount);
            const depositsBefore = await interaction.deposits(aMaticc.address);
            expect(depositsBefore).eq(depositAmount);
           
            await interaction.setProvider(collateralToken.address, Provider.address)
            await expect(
                interaction.connect(signer2).withdraw(
                signer1.address,
                aMaticc.address,
                withdrawAmount
            )).to.be.revertedWith("Interaction/Only stablecoin provider can call this function for this token");
        });

        it("borrow(): should let user borrow", async function () {
            await setCollateralType();
            const depositAmount = parseEther("1000");
            await aMaticc.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256)
            await expect(interaction.borrow(aMaticc.address, 0)).to.be.revertedWith("Interaction/invalid-stablecoinAmount");
            await expect(
                interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                depositAmount
            )).to.emit(interaction, "Deposit")
            .withArgs(signer1.address, collateralToken.address, depositAmount, depositAmount);
            const depositsBefore = await interaction.deposits(aMaticc.address);
            expect(depositsBefore).eq(depositAmount);
              
            const ledger_ilks = await ledger.ilks(collateral);
            const availableToBorrowBefore = await interaction.availableToBorrow(aMaticc.address, signer1.address);
            const locked = await interaction.locked(collateralToken.address, signer1.address);
            
            expect(depositAmount.eq(locked));
            assert.equal(Number(availableToBorrowBefore), (depositAmount.mul(ledger_ilks.vision))/1e27);
            
            const borrowAmount = availableToBorrowBefore
            await expect(
                interaction.connect(signer1).borrow(
                aMaticc.address,
                borrowAmount
            )).to.emit(interaction, "Borrow");
            
            const availableToBorrowAfter = await interaction.availableToBorrow(aMaticc.address, signer1.address);
            assert.equal(availableToBorrowAfter, availableToBorrowBefore - borrowAmount);
            expect(await interaction.borrowed(collateralToken.address, signer1.address)).to.be.equal(borrowAmount.add(100))
            expect(await interaction.totalPegLiquidity()).to.be.equal(borrowAmount)
        });

        it("borrow(): should let user borrow and compare getter function values", async function () {
            await setCollateralType();
            const depositAmount = parseEther("1000");
            await aMaticc.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256)
            await expect(
                interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                depositAmount
            )).to.emit(interaction, "Deposit")
            .withArgs(signer1.address, collateralToken.address, depositAmount, depositAmount);
            const depositsBefore = await interaction.deposits(aMaticc.address);
            expect(depositsBefore).eq(depositAmount);
              
            const ledger_ilks = await ledger.ilks(collateral);
            const availableToBorrowBefore = await interaction.availableToBorrow(aMaticc.address, signer1.address);
            const locked = await interaction.locked(collateralToken.address, signer1.address);
            
            expect(depositAmount).eq(locked);
            assert.equal(Number(availableToBorrowBefore), (depositAmount.mul(ledger_ilks.vision)) / 1e27);
            await interaction.upchostJail(collateralToken.address)
            
            const borrowAmount = availableToBorrowBefore;
            await interaction.connect(signer1).borrow(aMaticc.address,borrowAmount);
            await interaction.borrowApr(collateralToken.address);
            
            const estLiqPriceStablecoin = await interaction.estimatedLiquidationPriceSTABLECOIN(collateralToken.address, signer1.address, borrowAmount);
            // expect(estLiqPriceStablecoin).gt(borrowAmount);

            const estimatedLiquidationPrice = await interaction.estimatedLiquidationPrice(collateralToken.address, signer1.address, borrowAmount);
            // expect(estimatedLiquidationPrice).gt(borrowAmount);

            const currentLiquidationPrice = await interaction.currentLiquidationPrice(collateralToken.address, signer1.address);
            // expect(currentLiquidationPrice).gt(borrowAmount);

            const willBorrow = await interaction.willBorrow(collateralToken.address, signer1.address, depositAmount);
            expect(willBorrow).eq(borrowAmount);

            const free = await interaction.free(collateralToken.address, signer1.address);
            expect(free).eq(0);

            const collateralTVL = await interaction.collateralTVL(collateralToken.address);
            expect(collateralTVL).eq(borrowAmount);

            const depositTVL = await interaction.depositTVL(collateralToken.address);
            const price = await oracle.peek();
            expect(depositTVL).eq(depositAmount.mul(price[0] / 1e18)); // 2$ oracle price

            
            const stablecoinPrice = await interaction.stablecoinPrice(collateralToken.address);
            expect(stablecoinPrice).eq(parseEther("1"));
            
            const collateralPrice = await interaction.collateralPrice(collateralToken.address);
            expect(collateralPrice).eq(parseEther("2"));

            const collateralRate = await interaction.collateralRate(collateralToken.address);
            assert.equal(collateralRate, 1e45 / _mat);
        });

        it("revert:: borrow(): should not let borrow more than available", async function () {
            await setCollateralType();
            const depositAmount = parseEther("1000");
            await aMaticc.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256)
            await expect(
                interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                depositAmount
            )).to.emit(interaction, "Deposit")
            .withArgs(signer1.address, collateralToken.address, depositAmount, depositAmount);
            const depositsBefore = await interaction.deposits(aMaticc.address);
            expect(depositsBefore).eq(depositAmount);
              
            const ledger_ilks = await ledger.ilks(collateral);
            const availableToBorrowBefore = await interaction.availableToBorrow(aMaticc.address, signer1.address);
            const locked = await interaction.locked(collateralToken.address, signer1.address);
            
            expect(depositAmount).eq(locked);
            assert.equal(Number(availableToBorrowBefore), (depositAmount.mul(ledger_ilks.vision))/1e27);
            
            const borrowAmount = availableToBorrowBefore + 1
            await expect(
                interaction.connect(signer1).borrow(
                aMaticc.address,
                borrowAmount
            )).to.be.revertedWith("Ledger/not-safe");
        });

        it("revert:: withdraw(): should not let withdraw when user has outstanding debt", async function () {
            await setCollateralType();
            const depositAmount = parseEther("1000");
            const withdrawAmount = parseEther("500");
            await aMaticc.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256)
            await expect(
                interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                depositAmount
            )).to.emit(interaction, "Deposit")
            .withArgs(signer1.address, collateralToken.address, depositAmount, depositAmount);
            const depositsBefore = await interaction.deposits(aMaticc.address);
            expect(depositsBefore).eq(depositAmount);
              
            const ledger_ilks = await ledger.ilks(collateral);
            const availableToBorrowBefore = await interaction.availableToBorrow(aMaticc.address, signer1.address);
            const locked = await interaction.locked(collateralToken.address, signer1.address);
            
            expect(depositAmount).eq(locked);
            assert.equal(Number(availableToBorrowBefore), (depositAmount.mul(ledger_ilks.vision))/1e27);
            
            const borrowAmount = availableToBorrowBefore
            await expect(
                interaction.connect(signer1).borrow(
                aMaticc.address,
                borrowAmount
            )).to.emit(interaction, "Borrow");
            
            const availableToBorrowAfter = await interaction.availableToBorrow(aMaticc.address, signer1.address);
            assert.equal(availableToBorrowAfter, availableToBorrowBefore - borrowAmount);
            
            await expect(
                interaction.connect(signer1).withdraw(
                signer1.address,
                aMaticc.address,
                withdrawAmount
            )).to.be.revertedWith("Ledger/not-safe")
        });

        it("payback(): should let user payback outstanding debt(borrowed stablecoin)", async function () {
            await setCollateralType();
            const depositAmount = parseEther("1000");
            await aMaticc.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256);
            await stablecoin.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256);


            await expect(
                interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                depositAmount
            )).to.emit(interaction, "Deposit")
            .withArgs(signer1.address, collateralToken.address, depositAmount, depositAmount);
            const depositsBefore = await interaction.deposits(aMaticc.address);
            expect(depositsBefore).eq(depositAmount);
              
            const ledger_ilks = await ledger.ilks(collateral);
            const availableToBorrowBefore = await interaction.availableToBorrow(aMaticc.address, signer1.address);
            const locked = await interaction.locked(collateralToken.address, signer1.address);
            
            expect(depositAmount).eq(locked);
            assert.equal(Number(availableToBorrowBefore), (depositAmount.mul(ledger_ilks.vision))/1e27);
            
            const borrowAmount = availableToBorrowBefore
            await expect(
                interaction.connect(signer1).borrow(
                aMaticc.address,
                borrowAmount
            )).to.emit(interaction, "Borrow");
            
            const availableToBorrowAfter = await interaction.availableToBorrow(aMaticc.address, signer1.address);
            assert.equal(availableToBorrowAfter, availableToBorrowBefore - borrowAmount);

            const paybackAmount = (await interaction.borrowed(collateralToken.address, signer1.address))
            await expect(interaction.connect(signer1).payback(
                aMaticc.address,
                0
            )).to.be.revertedWith("Interaction/invalid-stablecoinAmount");
            await expect(
                interaction.connect(signer1).payback(
                aMaticc.address,
                paybackAmount
            )).to.emit(interaction, "Payback");
            
            const borrowed = await interaction.borrowed(collateralToken.address, signer1.address)
            expect(borrowed).eq(0);
        });

        it("revert:: payback(): should revert if user leave dust", async function () {
            await setCollateralType();
            const depositAmount = parseEther("1000");
            await aMaticc.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256);
            await stablecoin.connect(signer1).approve(interaction.address, ethers.constants.MaxUint256);

            await expect(
                interaction.connect(signer1).deposit(
                signer1.address,
                aMaticc.address,
                depositAmount
            )).to.emit(interaction, "Deposit")
            .withArgs(signer1.address, collateralToken.address, depositAmount, depositAmount);
            const depositsBefore = await interaction.deposits(aMaticc.address);
            expect(depositsBefore).eq(depositAmount);
              
            const ledger_ilks = await ledger.ilks(collateral);
            const availableToBorrowBefore = await interaction.availableToBorrow(aMaticc.address, signer1.address);
            const locked = await interaction.locked(collateralToken.address, signer1.address);
            
            expect(depositAmount).eq(locked);
            assert.equal(Number(availableToBorrowBefore), (depositAmount.mul(ledger_ilks.vision))/1e27);
            
            const borrowAmount = availableToBorrowBefore
            await expect(
                interaction.connect(signer1).borrow(
                aMaticc.address,
                borrowAmount
            )).to.emit(interaction, "Borrow");
            const availableToBorrowAfter = await interaction.availableToBorrow(aMaticc.address, signer1.address);
            assert.equal(availableToBorrowAfter, availableToBorrowBefore - borrowAmount);
            
            const paybackAmount = borrowAmount.sub(parseEther("1"))
            await expect(
                interaction.connect(signer1).payback(
                aMaticc.address,
                paybackAmount
            )).to.be.revertedWith("Ledger/dust");            
        });

        it("auction started as expected", async () => {
            const collateral1Price = toWad("400");
            await oracle.connect(deployer).setPrice(collateral1Price);

            await setCollateralType();
            // Approve and send some collateral inside. collateral value == 400 == `dink`
            const dink = toWad("10").toString();
            
            await aMaticc.connect(signer1).approve(interaction.address, dink);
            // Deposit collateral(aMATICc) to the interaction contract
            await interaction.connect(signer1).deposit(signer1.address, aMaticc.address, dink);
            const dart = toWad("1000").toString();
            await interaction.connect(signer1).borrow(aMaticc.address, dart);
            
            // change collateral price
            await oracle.connect(deployer).setPrice(toWad("124").toString());
            await vision.connect(deployer).poke(collateral);
            await interaction
            .connect(deployer)
            .startAuction(aMaticc.address, signer1.address, deployer.address);
        
            const sale = await jail.sales(1);
            expect(sale.usr).to.not.be.equal(ethers.utils.AddressZero);
        });

        it("revert:: cannot reset auction if status is false(redo not required)", async () => {
            const collateral1Price = toWad("400");
            await oracle.connect(deployer).setPrice(collateral1Price);

            await setCollateralType();
            // await aMaticc.connect(deployer).mint(signer1.address, toWad("10000").toString());
            // Approve and send some collateral inside. collateral value == 400 == `dink`
            const dink = toWad("10").toString();
            
            await aMaticc.connect(signer1).approve(interaction.address, dink);
            // Deposit collateral(aMATICc) to the interaction contract
            await interaction.connect(signer1).deposit(signer1.address, aMaticc.address, dink);
            const dart = toWad("1000").toString();
            await interaction.connect(signer1).borrow(aMaticc.address, dart);
            
            // change collateral price
            await oracle.connect(deployer).setPrice(toWad("124").toString());
            await vision.connect(deployer).poke(collateral);
            await interaction
            .connect(deployer)
            .startAuction(aMaticc.address, signer1.address, deployer.address);
        
            const sale = await jail.sales(1);
            expect(sale.usr).to.not.be.equal(ethers.utils.AddressZero);

            const auctions = await interaction.getAllActiveAuctionsForToken(collateralToken.address);
            assert.equal(auctions[0].usr, signer1.address);
            
            const list = await jail.list();
            const auctionStatus = await interaction.getAuctionStatus(collateralToken.address, list[0]);
            // returns true if AuctionRedo is required else returns false
            assert.equal(auctionStatus[0], false);

            // since redo is not required, therefore cannot reset the auction
            await expect(
                interaction
                .resetAuction(collateralToken.address, list[0], deployer.address)
            ).to.be.revertedWith("Jail/cannot-reset");
        });

        it("auction works as expected", async () => {
            const collateral1Price = toWad("400");
            await oracle.connect(deployer).setPrice(collateral1Price);

            await setCollateralType();

            await aMaticc.connect(deployer).mint(signer1.address, toWad("10000").toString());
            await aMaticc.connect(deployer).mint(signer2.address, toWad("10000").toString());
            await aMaticc.connect(deployer).mint(signer3.address, toWad("10000").toString());
        
            const dink1 = toWad("10").toString();
            const dink2 = toWad("1000").toString();
            const dink3 = toWad("1000").toString();
            await aMaticc.connect(signer1).approve(interaction.address, dink1);
            await aMaticc.connect(signer2).approve(interaction.address, dink2);
            await aMaticc.connect(signer3).approve(interaction.address, dink3);
            await interaction.connect(signer1).deposit(signer1.address, aMaticc.address, dink1);
            await interaction.connect(signer2).deposit(signer2.address, aMaticc.address, dink2);
            await interaction.connect(signer3).deposit(signer3.address, aMaticc.address, dink3);
        
            const dart1 = toWad("1000").toString();
            const dart2 = toWad("5000").toString();
            const dart3 = toWad("5000").toString();
            await interaction.connect(signer1).borrow(aMaticc.address, dart1);
            await interaction.connect(signer2).borrow(aMaticc.address, dart2);
            await interaction.connect(signer3).borrow(aMaticc.address, dart3);
        
            await oracle.connect(deployer).setPrice(toWad("124").toString());
            await vision.connect(deployer).poke(collateral);
        
            const auctionId = 1;
        
            let res = await interaction
              .connect(deployer)
              .startAuction(aMaticc.address, signer1.address, deployer.address);
            expect(res).to.emit(jail, "Kick");
        
            await ledger.connect(signer2).hope(jail.address);
            await ledger.connect(signer3).hope(jail.address);
        
            await stablecoin.connect(signer2).approve(interaction.address, toWad("10000").toString());
            await stablecoin.connect(signer3).approve(interaction.address, toWad("10000").toString());
        
            await advanceTime(1000);
        
            const aMaticcSigner2BalanceBefore = await aMaticc.balanceOf(signer2.address);
        
            await interaction.connect(signer2).buyFromAuction(
                aMaticc.address,
                auctionId,
                toWad("7").toString(),
                toRay("150").toString(),
                signer2.address,
            );
        
            await interaction.connect(signer3).buyFromAuction(
                aMaticc.address,
                auctionId,
                toWad("3").toString(),
                toRay("150").toString(),
                signer3.address,
            );

            const aMaticcSigner2BalanceAfter = await aMaticc.balanceOf(signer2.address);
            const sale = await jail.sales(auctionId);
        
            expect(aMaticcSigner2BalanceAfter.sub(aMaticcSigner2BalanceBefore)).to.be.equal(toWad("7").toString());
            expect(sale.pos).to.equal(0);
            expect(sale.tab).to.equal(0);
            expect(sale.lot).to.equal(0);
            expect(sale.tic).to.equal(0);
            expect(sale.top).to.equal(0);
            expect(sale.usr).to.equal(ethers.constants.AddressZero);
        });

        it("stringToBytes32(): should convert string to bytes32", async () => {
            let bytes = await interaction.stringToBytes32("aMATICc");
            assert.equal(bytes, collateral);
        });

        it("stringToBytes32(): should return 0x00 for empty string", async () => {
            let bytes = await interaction.stringToBytes32("");
            assert.equal(bytes, "0x0000000000000000000000000000000000000000000000000000000000000000");
        });

        it("removeCollateralType(): should remove an active collateral type", async () => {
            await setCollateralType();
            const tx = await interaction.removeCollateralType(collateralToken.address)
            const receipt = await tx.wait(1);
            
            let event = (receipt.events?.filter((x) => {return x.event === "CollateralDisabled"}));
            assert.equal(event[0].args.token, collateralToken.address);
            assert.equal(event[0].args.ilk, collateral);
        });

        it("revert:: removeCollateralType(): cannot remove an inactive collateral type", async () => {
            await expect(
                interaction
                .removeCollateralType(collateralToken.address)
            ).to.be.revertedWith("Interaction/token-not-init");
        });
    });

    describe("setters", function () {

        it("revert:: whitelist: only authorized account can enable whitelist", async function () {
            await expect(
                interaction
                .connect(signer1)
                .enableWhitelist()
            ).to.be.revertedWith("Interaction/not-authorized");
        });

        it("whitelist: should let authorized account enable whitelist", async function () {
            await interaction.connect(deployer).enableWhitelist();
            const whitelistMode = await interaction.whitelistMode();
            assert.equal(whitelistMode, 1);
        });

        it("revert:: whitelist: only authorized account can disable whitelist", async function () {
            await expect(
                interaction
                .connect(signer1)
                .disableWhitelist()
            ).to.be.revertedWith("Interaction/not-authorized");
        });
        
        it("whitelist: should let authorized account enable whitelist", async function () {
            await interaction.connect(deployer).enableWhitelist();
            await interaction.connect(deployer).disableWhitelist();
            const whitelistMode = await interaction.whitelistMode();
            assert.equal(whitelistMode, 0);
        });

        it("revert:: whitelist: only authorized account can set whitelist operator", async function () {
            await expect(
                interaction
                .connect(signer1)
                .setWhitelistOperator(signer1.address)
            ).to.be.revertedWith("Interaction/not-authorized");
        });
        
        it("whitelist: should let authorized account set whitelist operator", async function () {
            await interaction.connect(deployer).setWhitelistOperator(signer1.address);
            const whitelistOperator = await interaction.whitelistOperator();
            assert.equal(whitelistOperator, signer1.address);
        });

        it("revert:: whitelist: only authorized account can add an account to whitelist", async function () {
            await expect(
                interaction
                .connect(signer1)
                .addToWhitelist([signer1.address])
            ).to.be.revertedWith("Interaction/not-operator-or-ward");
        });
        
        it("whitelist: should whitelist operator add account to whitelist", async function () {
            await interaction.connect(deployer).setWhitelistOperator(signer1.address);
            await interaction.connect(signer1).addToWhitelist([signer2.address]);
            const whitelisted = await interaction.whitelist(signer2.address);
            assert.equal(whitelisted, true);
        });

        it("revert:: whitelist: only authorized account can remove an account from whitelist", async function () {
            await expect(
                interaction
                .connect(signer1)
                .removeFromWhitelist([signer1.address])
            ).to.be.revertedWith("Interaction/not-operator-or-ward");
        });
        
        it("whitelist: should whitelist operator remove account to whitelist", async function () {
            await interaction.connect(deployer).setWhitelistOperator(signer1.address);
            await interaction.connect(signer1).addToWhitelist([signer2.address]);
            let whitelisted = await interaction.whitelist(signer2.address);
            assert.equal(whitelisted, true);
            await interaction.connect(signer1).removeFromWhitelist([signer2.address]);
            whitelisted = await interaction.whitelist(signer2.address);
            assert.equal(whitelisted, false);
        });

        it("setCores(): only authorized account can set core contracts", async function () {
            await expect(
                interaction
                .connect(signer1)
                .setCores(signer1.address, signer2.address, signer3.address, deployer.address)
            ).to.be.revertedWith("Interaction/not-authorized");
        });

        it("setCores(): should let authorized account set core contracts", async function () {
            await interaction.setCores(ledger.address, vision.address, stablecoinJoin.address, fee.address);
        });

        it("setStablecoinApprove(): only authorized account can set core contracts", async function () {
            await expect(
                interaction
                .connect(signer1)
                .setStablecoinApprove()
            ).to.be.revertedWith("Interaction/not-authorized");
        });

        it("setStablecoinApprove(): should let authorized account set core contracts", async function () {
            await interaction.setStablecoinApprove();
            let allowance = await stablecoin.allowance(interaction.address, stablecoinJoin.address);
            expect(allowance).eq(ethers.constants.MaxUint256)
        });

        it("setCollateralType(): only authorized account can set core contracts", async function () {
            await expect(
                interaction
                .connect(signer1)
                .setCollateralType(
                    collateralToken.address,
                    gemJoin.address,
                    _ilkCeMatic,
                    jail.address,
                    _mat)
            ).to.be.revertedWith("Interaction/not-authorized");
        });

        it("setCollateralType(): collateral type can be set for once only", async function () {
            await setCollateralType();
            await expect(
                interaction
                .connect(deployer)
                .setCollateralType(
                    collateralToken.address,
                    gemJoin.address,
                    _ilkCeMatic,
                    jail.address,
                    _mat)
            ).to.be.revertedWith("Interaction/token-already-init");
        });

        it("rely()/deny(): should rely and deny on an address", async function () {
            await interaction.rely(signer2.address);
            expect(await interaction.wards(signer2.address)).to.be.equal(1);
            await interaction.deny(signer2.address);
            expect(await interaction.wards(signer2.address)).to.be.equal(0);
        });
        it("setCollateralDuty(): should set correct duty rate for collateral", async function () {
            await setCollateralType();
            await interaction.setCollateralDuty(aMaticc.address, "1000000003022266000000000000");
            expect((await fee.ilks(_ilkCeMatic)).duty).to.be.equal("1000000003022266000000000000");
        });
        it("revert:: should reverts when new collateral with null ilk is set", async function () {
            await expect(interaction.setCollateralType(collateralToken.address, gemJoin.address, NULL_ILK, jail.address, _mat)).to.be.revertedWith("Interaction/empty-ilk");
        });
        it("deposit while whitelist mode is enabled", async function () {
            await interaction.enableWhitelist();
            await expect(interaction.deposit(deployer.address, aMaticc.address, "1")).to.be.revertedWith("Interaction/not-in-whitelist");
        });
        it("reverts: 0 stablecoin provider address", async function () {
            await expect(interaction.setProvider(aMaticc.address, NULL_ADDRESS)).to.be.revertedWith("");
        });
    })
});