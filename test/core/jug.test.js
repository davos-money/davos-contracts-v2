const { ethers, network } = require('hardhat');
const { expect } = require("chai");

describe('===Fee===', function () {
    let deployer, signer1, signer2;

    let wad = "000000000000000000", // 18 Decimals
        ray = "000000000000000000000000000", // 27 Decimals
        rad = "000000000000000000000000000000000000000000000"; // 45 Decimals

    let collateral = ethers.utils.formatBytes32String("TEST");

    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

    beforeEach(async function () {

        [deployer, signer1, signer2] = await ethers.getSigners();

        // Contract factory
        this.Fee = await ethers.getContractFactory("Fee");
        this.Ledger = await ethers.getContractFactory("Ledger");
        this.ProxyLike = await ethers.getContractFactory("ProxyLike");
        this.Licensor = await hre.ethers.getContractFactory("Licensor");
        
        // Contract deployment
        ledger = await upgrades.deployProxy(this.Ledger, [], {initializer: "initialize"});
        await ledger.deployed();
        fee = await upgrades.deployProxy(this.Fee, [ledger.address], {initializer: "initialize"});
        await fee.deployed();
        proxyLike = await this.ProxyLike.connect(deployer).deploy(fee.address, ledger.address);
        await proxyLike.deployed();
        licensor = await upgrades.deployProxy(this.Licensor, [deployer.address, 0, 0], {initializer: "initialize"});
    });

    describe('--- initialize()', function () {
        it('initialize', async function () {
            expect(await fee.ledger()).to.be.equal(ledger.address);
        });
    });
    describe('--- init()', function () {
        it('reverts: Fee/ilk-already-init', async function () {
            await fee.init(collateral);
            await expect(fee.init(collateral)).to.be.revertedWith("Fee/ilk-already-init");
        });
        it('inits an ilk', async function () {
            await fee.init(collateral);
            expect(await (await fee.ilks(collateral)).duty).to.be.equal("1" + ray);
        });
    });
    describe('--- rely()', function () {
        it('reverts: Fee/not-authorized', async function () {
            await fee.deny(deployer.address);
            await expect(fee.rely(signer1.address)).to.be.revertedWith("Fee/not-authorized");
            expect(await fee.wards(signer1.address)).to.be.equal("0");
        });
        it('relies on address', async function () {
            await fee.rely(signer1.address);
            expect(await fee.wards(signer1.address)).to.be.equal("1");
        });
    });
    describe('--- deny()', function () {
        it('reverts: Fee/not-authorized', async function () {
            await fee.deny(deployer.address);
            await expect(fee.deny(signer1.address)).to.be.revertedWith("Fee/not-authorized");
        });
        it('denies an address', async function () {
            await fee.rely(signer1.address);
            expect(await fee.wards(signer1.address)).to.be.equal("1");
            await fee.deny(signer1.address);
            expect(await fee.wards(signer1.address)).to.be.equal("0");
        });
    });
    describe('--- file(3)', function () {
        it('reverts: Fee/rho-not-updated', async function () {
            await expect(fee.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, ethers.utils.formatBytes32String("duty"), "100" + rad)).to.be.revertedWith("Fee/rho-not-updated");
        });
        it('reverts: Fee/file-unrecognized-param', async function () {
            await fee.rely(proxyLike.address);
            await expect(proxyLike.connect(deployer).feeInitFile(collateral, ethers.utils.formatBytes32String("dutyt"), "100" + rad)).to.be.revertedWith("Fee/file-unrecognized-param");
        });
        it('sets duty rate', async function () {
            await fee.rely(proxyLike.address);
            await proxyLike.connect(deployer).feeInitFile(collateral, ethers.utils.formatBytes32String("duty"), "1" + ray);
            expect(await (await fee.ilks(collateral)).duty).to.be.equal("1" + ray);
        });
    });
    describe('--- file(2a)', function () {
        it('reverts: Fee/file-unrecognized-param', async function () {
            await expect(fee.connect(deployer)["file(bytes32,uint256)"](ethers.utils.formatBytes32String("bases"), "1" + ray)).to.be.revertedWith("Fee/file-unrecognized-param");
        });
        it('sets base rate', async function () {
            await fee.connect(deployer)["file(bytes32,uint256)"](ethers.utils.formatBytes32String("base"), "1" + ray);
            expect(await fee.base()).to.be.equal("1" + ray);
        });
    });
    describe('--- file(2b)', function () {
        it('reverts: Fee/file-unrecognized-param', async function () {
            await expect(fee.connect(deployer)["file(bytes32,address)"](ethers.utils.formatBytes32String("bases"), signer2.address)).to.be.revertedWith("Fee/file-unrecognized-param");
        });
        it('sets settlement', async function () {
            await fee.connect(deployer)["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), signer2.address);
            expect(await fee.settlement()).to.be.equal(signer2.address);
        });
    });
    describe('--- drip()', function () {
        it('drips a rate', async function () {
            await fee.connect(deployer)["file(bytes32,uint256)"](ethers.utils.formatBytes32String("base"), "1" + ray);
            await fee.connect(deployer)["file(bytes32,address)"](ethers.utils.formatBytes32String("settlement"), signer2.address);
            await fee["file(bytes32,address)"](ethers.utils.formatBytes32String("licensor"), licensor.address);

            await ledger.rely(fee.address);
            
            await fee.drip(collateral);
        });
    });
});