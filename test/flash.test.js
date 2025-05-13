const { ethers, network } = require('hardhat');
const { expect } = require("chai");

describe('===Flash===', function () {
    let deployer, signer1, signer2;

    let wad = "000000000000000000", // 18 Decimals
        ray = "000000000000000000000000000", // 27 Decimals
        rad = "000000000000000000000000000000000000000000000"; // 45 Decimals

    let collateral = ethers.utils.formatBytes32String("TEST");

    beforeEach(async function () {

        [deployer, signer1, signer2] = await ethers.getSigners();

        // Contract factory
        this.Ledger = await ethers.getContractFactory("Ledger");
        this.Settlement = await ethers.getContractFactory("Settlement");
        this.Stablecoin = await ethers.getContractFactory("Stablecoin");
        this.StablecoinJoin = await ethers.getContractFactory("StablecoinJoin");
        this.Flash = await ethers.getContractFactory("Flash");
        this.BorrowingContract = await ethers.getContractFactory("FlashBorrower");

        // Contract deployment
        ledger = await upgrades.deployProxy(this.Ledger, [], {initializer: "initialize"});
        await ledger.deployed();
        stablecoin = await upgrades.deployProxy(this.Stablecoin, [97, "Stablecoin", "100" + wad], {initializer: "initialize"});
        await stablecoin.deployed();
        stablecoinjoin = await upgrades.deployProxy(this.StablecoinJoin, [ledger.address, stablecoin.address], {initializer: "initialize"});
        await stablecoinjoin.deployed();
        settlement = await upgrades.deployProxy(this.Settlement, [ledger.address, stablecoinjoin.address, deployer.address], {initializer: "initialize"});
        await settlement.deployed();
        flash = await upgrades.deployProxy(this.Flash, [ledger.address, stablecoin.address, stablecoinjoin.address, settlement.address], {initializer: "initialize"});
        await flash.deployed();
        borrowingContract = await this.BorrowingContract.connect(deployer).deploy(flash.address);
        await borrowingContract.deployed();
    });

    describe('--- initialize()', function () {
        it('initialize', async function () {
            expect(await flash.wards(deployer.address)).to.be.equal("1");
        });
    });
    describe('--- rely()', function () {
        it('reverts: Flash/not-authorized', async function () {
            await expect(flash.connect(signer2).rely(signer1.address)).to.be.revertedWith("Flash/not-authorized");
            expect(await flash.wards(signer1.address)).to.be.equal("0");
        });
        it('relies on address', async function () {
            await flash.rely(signer1.address);
            expect(await flash.wards(signer1.address)).to.be.equal("1");
        });
    });
    describe('--- deny()', function () {
        it('reverts: Flash/not-authorized', async function () {
            await expect(flash.connect(signer2).deny(signer1.address)).to.be.revertedWith("Flash/not-authorized");
        });
        it('denies an address', async function () {
            await flash.rely(signer1.address);
            expect(await flash.wards(signer1.address)).to.be.equal("1");
            await flash.deny(signer1.address);
            expect(await flash.wards(signer1.address)).to.be.equal("0");
        });
    });
    describe('--- file(2)', function () {
        it('reverts: Flash/ceiling-too-high', async function () {
            await expect(flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("max"), "100" + rad)).to.be.revertedWith("Flash/ceiling-too-high");
        });
        it('reverts: Flash/file-unrecognized-param', async function () {
            await expect(flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("maxi"), "100" + rad)).to.be.revertedWith("Flash/file-unrecognized-param");
        });
        it('sets max', async function () {
            await flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("max"), "5" + wad);
            expect(await flash.max()).to.be.equal("5" + wad);
        });
        it('sets toll', async function () {
            await flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("toll"), "1" + wad);
            expect(await flash.toll()).to.be.equal("1" + wad);
        });
    });
    describe('--- maxFlashLoan()', function () {
        it('other token', async function () {
            expect(await flash.maxFlashLoan(deployer.address)).to.be.equal("0");
        });
        it('loan token', async function () {
            await flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("max"), "5" + wad);
            expect(await flash.maxFlashLoan(stablecoin.address)).to.be.equal("5" + wad);
        });
    });
    describe('--- flashFee()', function () {
        it('reverts: Flash/token-unsupported', async function () {
            await expect(flash.flashFee(deployer.address, "1" + wad)).to.be.revertedWith("Flash/token-unsupported");
        });
        it('calculates flashFee', async function () {
            await flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("toll"), "1" + wad);
            expect(await flash.flashFee(stablecoin.address, "1" + wad)).to.be.equal("1" +  wad);
        });
    });
    describe('--- flashLoan()', function () {
        it('reverts: Flash/token-unsupported', async function () {
            await flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("max"), "10" + wad);
            await flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("toll"), "10000000000000000"); // 1%
            stablecoin2 = await this.Stablecoin.connect(deployer).deploy();
            await stablecoin2.deployed();
            await expect(borrowingContract.flashBorrow(stablecoin2.address, "1" + wad)).to.be.revertedWith("Flash/token-unsupported");
        });
        it('reverts: Flash/ceiling-exceeded', async function () {
            await flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("max"), "10" + wad);
            await flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("toll"), "10000000000000000"); // 1%
            await expect(borrowingContract.flashBorrow(stablecoin.address, "11" + wad)).to.be.revertedWith("Flash/ceiling-exceeded");
        });
        it('reverts: Flash/ledger-not-live', async function () {
            await flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("max"), "10" + wad);
            await flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("toll"), "10000000000000000"); // 1%
            await ledger.cage();
            await expect(borrowingContract.flashBorrow(stablecoin.address, "9" + wad)).to.be.revertedWith("Flash/ledger-not-live");
        });
        it('flash mints, burns and accrues with fee', async function () {
            await ledger.init(collateral);
            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);
            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, stablecoinjoin.address, 0, "20" + wad);
            await ledger.rely(flash.address);
            await ledger.rely(stablecoinjoin.address);

            await stablecoin.rely(stablecoinjoin.address);

            await stablecoinjoin.rely(flash.address);

            await flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("max"), "10" + wad);
            await flash.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("toll"), "10000000000000000"); // 1%
            await stablecoin.mint(borrowingContract.address, "1000000000000000000"); // Minting 1% fee that will be returned with 1 wad next
            await borrowingContract.flashBorrow(stablecoin.address, "1" + wad);

            expect(await ledger.stablecoin(settlement.address)).to.be.equal("0" + rad);
            await flash.accrue();
            expect(await ledger.stablecoin(settlement.address)).to.be.equal("10000000000000000000000000000000000000000000"); // Surplus from Flash fee
        });
    });
});