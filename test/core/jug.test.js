const { ethers, network } = require('hardhat');
const { expect } = require("chai");

describe('===Jug===', function () {
    let deployer, signer1, signer2;

    let wad = "000000000000000000", // 18 Decimals
        ray = "000000000000000000000000000", // 27 Decimals
        rad = "000000000000000000000000000000000000000000000"; // 45 Decimals

    let collateral = ethers.utils.formatBytes32String("TEST");

    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

    beforeEach(async function () {

        [deployer, signer1, signer2] = await ethers.getSigners();

        // Contract factory
        this.Jug = await ethers.getContractFactory("Jug");
        this.Vat = await ethers.getContractFactory("Vat");
        this.ProxyLike = await ethers.getContractFactory("ProxyLike");
        this.Licensor = await hre.ethers.getContractFactory("Licensor");
        
        // Contract deployment
        vat = await upgrades.deployProxy(this.Vat, [], {initializer: "initialize"});
        await vat.deployed();
        jug = await upgrades.deployProxy(this.Jug, [vat.address], {initializer: "initialize"});
        await jug.deployed();
        proxyLike = await this.ProxyLike.connect(deployer).deploy(jug.address, vat.address);
        await proxyLike.deployed();
        licensor = await upgrades.deployProxy(this.Licensor, [deployer.address, 0, 0], {initializer: "initialize"});
    });

    describe('--- initialize()', function () {
        it('initialize', async function () {
            expect(await jug.vat()).to.be.equal(vat.address);
        });
    });
    describe('--- init()', function () {
        it('reverts: Jug/ilk-already-init', async function () {
            await jug.init(collateral);
            await expect(jug.init(collateral)).to.be.revertedWith("Jug/ilk-already-init");
        });
        it('inits an ilk', async function () {
            await jug.init(collateral);
            expect(await (await jug.ilks(collateral)).duty).to.be.equal("1" + ray);
        });
    });
    describe('--- rely()', function () {
        it('reverts: Jug/not-authorized', async function () {
            await jug.deny(deployer.address);
            await expect(jug.rely(signer1.address)).to.be.revertedWith("Jug/not-authorized");
            expect(await jug.wards(signer1.address)).to.be.equal("0");
        });
        it('relies on address', async function () {
            await jug.rely(signer1.address);
            expect(await jug.wards(signer1.address)).to.be.equal("1");
        });
    });
    describe('--- deny()', function () {
        it('reverts: Jug/not-authorized', async function () {
            await jug.deny(deployer.address);
            await expect(jug.deny(signer1.address)).to.be.revertedWith("Jug/not-authorized");
        });
        it('denies an address', async function () {
            await jug.rely(signer1.address);
            expect(await jug.wards(signer1.address)).to.be.equal("1");
            await jug.deny(signer1.address);
            expect(await jug.wards(signer1.address)).to.be.equal("0");
        });
    });
    describe('--- file(3)', function () {
        it('reverts: Jug/rho-not-updated', async function () {
            await expect(jug.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, ethers.utils.formatBytes32String("duty"), "100" + rad)).to.be.revertedWith("Jug/rho-not-updated");
        });
        it('reverts: Jug/file-unrecognized-param', async function () {
            await jug.rely(proxyLike.address);
            await expect(proxyLike.connect(deployer).jugInitFile(collateral, ethers.utils.formatBytes32String("dutyt"), "100" + rad)).to.be.revertedWith("Jug/file-unrecognized-param");
        });
        it('sets duty rate', async function () {
            await jug.rely(proxyLike.address);
            await proxyLike.connect(deployer).jugInitFile(collateral, ethers.utils.formatBytes32String("duty"), "1" + ray);
            expect(await (await jug.ilks(collateral)).duty).to.be.equal("1" + ray);
        });
    });
    describe('--- file(2a)', function () {
        it('reverts: Jug/file-unrecognized-param', async function () {
            await expect(jug.connect(deployer)["file(bytes32,uint256)"](ethers.utils.formatBytes32String("bases"), "1" + ray)).to.be.revertedWith("Jug/file-unrecognized-param");
        });
        it('sets base rate', async function () {
            await jug.connect(deployer)["file(bytes32,uint256)"](ethers.utils.formatBytes32String("base"), "1" + ray);
            expect(await jug.base()).to.be.equal("1" + ray);
        });
    });
    describe('--- file(2b)', function () {
        it('reverts: Jug/file-unrecognized-param', async function () {
            await expect(jug.connect(deployer)["file(bytes32,address)"](ethers.utils.formatBytes32String("bases"), signer2.address)).to.be.revertedWith("Jug/file-unrecognized-param");
        });
        it('sets vow', async function () {
            await jug.connect(deployer)["file(bytes32,address)"](ethers.utils.formatBytes32String("vow"), signer2.address);
            expect(await jug.vow()).to.be.equal(signer2.address);
        });
    });
    describe('--- drip()', function () {
        it('drips a rate', async function () {
            await jug.connect(deployer)["file(bytes32,uint256)"](ethers.utils.formatBytes32String("base"), "1" + ray);
            await jug.connect(deployer)["file(bytes32,address)"](ethers.utils.formatBytes32String("vow"), signer2.address);
            await jug["file(bytes32,address)"](ethers.utils.formatBytes32String("licensor"), licensor.address);

            await vat.rely(jug.address);
            
            await jug.drip(collateral);
        });
    });
});