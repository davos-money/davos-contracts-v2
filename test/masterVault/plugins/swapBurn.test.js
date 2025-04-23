const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');
const fs = require("fs");
const path = require("path");

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

describe('===SwapBurn===', function () {
    let deployer, susdeHolder, usdeHolder, signer1;

    let davos, susde, usde,
        mv, vow, yieldModule, licensor, priceController, ratioProvider,
        router, permit2, priceFeed,
        swapburn;

    beforeEach(async function () {

        [deployer, susdeHolder, usdeHolder, signer1] = await ethers.getSigners();

        // FORKING
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                    jsonRpcUrl: "https://eth.llamarpc.com",
                    blockNumber: 22317141
                    },
                },
            ],
        });

        // IMPERSONATE
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0x211Cc4DD073734dA055fbF44a2b4667d5E5fE5d2"],
        });
        await network.provider.send("hardhat_setBalance", [
            "0x211Cc4DD073734dA055fbF44a2b4667d5E5fE5d2",
            "0x10000000000000000000",
        ]);
        susdeHolder = await ethers.getSigner("0x211Cc4DD073734dA055fbF44a2b4667d5E5fE5d2")

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0x33AE83071432116AE892693b45466949a38Ac74C"],
        });
        await network.provider.send("hardhat_setBalance", [
            "0x33AE83071432116AE892693b45466949a38Ac74C",
            "0x10000000000000000000",
        ]);
        usdeHolder = await ethers.getSigner("0x33AE83071432116AE892693b45466949a38Ac74C")

        // Contract factory
        this.Token = await ethers.getContractFactory("Token");
        this.MasterVault = await ethers.getContractFactory("MasterVault");
        this.Licensor = await ethers.getContractFactory("Licensor");
        this.YieldModule = await ethers.getContractFactory("YieldModule");
        this.PriceController = await ethers.getContractFactory("PriceController");

        this.SwapBurn = await ethers.getContractFactory("SwapBurn");
        this.MockVow = await ethers.getContractFactory("MockVow");

        // Contract deployment
        susde = await ethers.getContractAt("Token", "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497");  // susde
        usde = await ethers.getContractAt("Token", "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3");   // usde
        davos = await ethers.getContractAt("Token", "0xdAC17F958D2ee523a2206206994597C13D831ec7");  // USDT

        mv = await upgrades.deployProxy(this.MasterVault, ["Master Vault Token", "ceMATIC", susde.address], {initializer: "initialize"});
        await mv.deployed();

        ratioProvider = await upgrades.deployProxy(this.Token, ["name", "symbol"], {initializer: "initialize"});
        await mv.deployed();

        priceController = await upgrades.deployProxy(this.PriceController, [], {initializer: "initialize"});
        await priceController.deployed();

        licensor = await upgrades.deployProxy(this.Licensor, [deployer.address, 0, 0], {initializer: "initialize"});
        await licensor.deployed();

        yieldModule = await upgrades.deployProxy(this.YieldModule, [mv.address, licensor.address, 1000], {initializer: "initialize"});
        await yieldModule.deployed();

        vow = await this.MockVow.deploy(davos.address); 
        await vow.deployed();

        router = "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af";
        permit2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
        priceFeed = "0xa569d910839Ae8865Da8F8e70FfFb0cBA869F961"; // usde/usdt
        swapburn = await upgrades.deployProxy(this.SwapBurn, [vow.address, router, permit2, priceFeed], {initializer: "initialize"});

        // Contract init
        await priceController.setToken(susde.address, 'convertToAssets(uint256)', 'convertToShares(uint256)', '', false);
        await yieldModule.changePriceController(priceController.address);
        await mv.addModule(yieldModule.address, "0x");
        await mv.changeDavosProvider(signer1.address);

        // Note: v4 Pool's Tier Fee and TickSpacing must match following, need poolId to get them
        // A quick way to fetch poolId is via browser console, graphQL response from response tab
        // Convert base64 to bytes32, to get bytes32 id, trim elements to right to get bytes25 id
        // PositionManager.poolKeys(bytes25 id)
        await swapburn.setParams(davos.address, 200, 4, 20, 10000);  // 0.02% Fee + 1% Slippage 
    });

    describe('--- initialize', function () {

        it('initializes', async () => {

            swapburn = await upgrades.deployProxy(await ethers.getContractFactory("SwapBurn"), [vow.address, router, permit2, priceFeed], {initializer: "initialize"});
            expect(await swapburn.router()).to.be.eq(router);
            expect(await swapburn.permit2()).to.be.eq(permit2);
            expect(await swapburn.priceFeed()).to.be.eq(priceFeed);
            expect(await swapburn.vow()).to.be.eq(vow.address);
        })
    });

    describe('--- afterHook', function () {

        it('swaps and then burns ', async () => {
            this.timeout(60000000);

            await susde.connect(susdeHolder).transfer(signer1.address, ethers.utils.parseEther('10'));
            await susde.connect(signer1).approve(mv.address, ethers.utils.parseEther('10'));
            await mv.connect(signer1).deposit(ethers.utils.parseEther('10'), signer1.address);

            // Artifically generating yield
            await susde.connect(susdeHolder).transfer(mv.address, ethers.utils.parseEther('100'));

            let vy = await yieldModule.getVaultYield();
            expect(vy.toString()).to.be.not.eq('0')

            // Setting yieldModule's plugin
            await yieldModule.changePlugin(swapburn.address);

            // Claim yield triggering plugin hooks
            await yieldModule.claimYield();

            // MockVow has the amount
            let vAmount = await davos.balanceOf(vow.address);
            expect(vAmount).to.be.closeTo("11600000", "100000");  // 100000 = 0.1 USDT
        })
    });
});