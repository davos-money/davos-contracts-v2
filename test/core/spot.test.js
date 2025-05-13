const { ethers, network } = require('hardhat');
const { expect } = require("chai");

describe('===Vision===', function () {
    let deployer, signer1, signer2;

    let wad = "000000000000000000", // 18 Decimals
        ray = "000000000000000000000000000", // 27 Decimals
        rad = "000000000000000000000000000000000000000000000"; // 45 Decimals

    let collateral = ethers.utils.formatBytes32String("TEST");

    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

    beforeEach(async function () {

        [deployer, signer1, signer2] = await ethers.getSigners();

        // Contract factory
        this.Vision = await ethers.getContractFactory("Vision");
        this.Ledger = await ethers.getContractFactory("Ledger");
        this.Oracle = await ethers.getContractFactory("Oracle");

        // Contract deployment
        ledger = await upgrades.deployProxy(this.Ledger, [], {initializer: "initialize"});
        await ledger.deployed();
        vision = await upgrades.deployProxy(this.Vision, [ledger.address], {initializer: "initialize"});
        await vision.deployed();
        oracle = await this.Oracle.deploy();
        await oracle.deployed();
    });

    describe('--- initialize()', function () {
        it('initialize', async function () {
            expect(await vision.ledger()).to.be.equal(ledger.address);
        });
    });
    describe('--- rely()', function () {
        it('reverts: Vision/not-authorized', async function () {
            await vision.deny(deployer.address);
            await expect(vision.rely(signer1.address)).to.be.revertedWith("Vision/not-authorized");
            expect(await vision.wards(signer1.address)).to.be.equal("0");
        });
        it('relies on address', async function () {
            await vision.rely(signer1.address);
            expect(await vision.wards(signer1.address)).to.be.equal("1");
        });
    });
    describe('--- deny()', function () {
        it('reverts: Vision/not-authorized', async function () {
            await vision.deny(deployer.address);
            await expect(vision.deny(signer1.address)).to.be.revertedWith("Vision/not-authorized");
        });
        it('denies an address', async function () {
            await vision.rely(signer1.address);
            expect(await vision.wards(signer1.address)).to.be.equal("1");
            await vision.deny(signer1.address);
            expect(await vision.wards(signer1.address)).to.be.equal("0");
        });
    });
    describe('--- file(3a)', function () {
        it('reverts: Vision/not-live', async function () {
            await vision.cage();
            await expect(vision.connect(deployer)["file(bytes32,bytes32,address)"](collateral, await ethers.utils.formatBytes32String("pip"), signer2.address)).to.be.revertedWith("Vision/not-live");
        });
        it('reverts: Vision/file-unrecognized-param', async function () {
            await expect(vision.connect(deployer)["file(bytes32,bytes32,address)"](collateral, await ethers.utils.formatBytes32String("pipa"), signer2.address)).to.be.revertedWith("Vision/file-unrecognized-param");
        });
        it('sets pip', async function () {
            await vision.connect(deployer)["file(bytes32,bytes32,address)"](collateral, await ethers.utils.formatBytes32String("pip"), signer2.address);
            expect(await (await vision.ilks(collateral)).pip).to.be.equal(signer2.address);
        });
    });
    describe('--- file(2)', function () {
        it('reverts: Vision/not-live', async function () {
            await vision.cage();
            await expect(vision.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("par"), "1" + ray)).to.be.revertedWith("Vision/not-live");
        });
        it('reverts: Vision/file-unrecognized-param', async function () {
            await expect(vision.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("para"), "1" + ray)).to.be.revertedWith("Vision/file-unrecognized-param");
        });
        it('sets par', async function () {
            await vision.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("par"), "1" + ray);
            expect(await vision.par()).to.be.equal("1" + ray);
        });
    });
    describe('--- file(3b)', function () {
        it('reverts: Vision/not-live', async function () {
            await vision.cage();
            await expect(vision.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("mat"), "1" + ray)).to.be.revertedWith("Vision/not-live");
        });
        it('reverts: Vision/file-unrecognized-param', async function () {
            await expect(vision.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("mata"), "1" + ray)).to.be.revertedWith("Vision/file-unrecognized-param");
        });
        it('sets mat', async function () {
            await vision.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("mat"), "1" + ray);
            expect(await (await vision.ilks(collateral)).mat).to.be.equal("1" + ray);
        });
    });
    describe('--- poke()', function () {
        it('pokes new price of an ilk', async function () {

            await oracle.setPrice("5" + wad);
            await vision.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("par"), "1" + ray);
            await vision.connect(deployer)["file(bytes32,bytes32,address)"](collateral, await ethers.utils.formatBytes32String("pip"), oracle.address);
            await vision.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("mat"), "1" + ray);

            await ledger.rely(vision.address);

            await vision.poke(collateral);
        });
    });
    describe('--- uncage()', function () {
        it('uncages previouly caged', async function () {
            await vision.cage();
            await vision.uncage();
            expect(await vision.live()).to.be.equal(1);
        });
    });
});