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
        this.Stablecoin = await ethers.getContractFactory("Stablecoin");

        // Contract deployment
        stablecoin = await upgrades.deployProxy(this.Stablecoin, [97, "STABLECOIN", "100" + wad], {initializer: "initialize"});
        await stablecoin.deployed();
    });

    describe('--- initialize()', function () {
        it('initialize', async function () {
            expect(await stablecoin.symbol()).to.be.equal("STABLECOIN");
        });
    });
    describe('--- rely()', function () {``
        it('reverts: Stablecoin/not-authorized', async function () {
            await stablecoin.deny(deployer.address);
            await expect(stablecoin.rely(signer1.address)).to.be.revertedWith("Stablecoin/not-authorized");
            expect(await stablecoin.wards(signer1.address)).to.be.equal("0");
        });
        it('relies on address', async function () {
            await stablecoin.rely(signer1.address);
            expect(await stablecoin.wards(signer1.address)).to.be.equal("1");
        });
    });
    describe('--- deny()', function () {
        it('reverts: Stablecoin/not-authorized', async function () {
            await stablecoin.deny(deployer.address);
            await expect(stablecoin.deny(signer1.address)).to.be.revertedWith("Stablecoin/not-authorized");
        });
        it('denies an address', async function () {
            await stablecoin.rely(signer1.address);
            expect(await stablecoin.wards(signer1.address)).to.be.equal("1");
            await stablecoin.deny(signer1.address);
            expect(await stablecoin.wards(signer1.address)).to.be.equal("0");
        });
    });
    describe('--- mint()', function () {
        it('reverts: Stablecoin/mint-to-zero-address', async function () {
            await expect(stablecoin.mint(NULL_ADDRESS, "1" + wad)).to.be.revertedWith("Stablecoin/mint-to-zero-address");
        });
        it('reverts: Stablecoin/cap-reached', async function () {
            await expect(stablecoin.mint(deployer.address, "101" + wad)).to.be.revertedWith("Stablecoin/cap-reached");
        });
        it('mints stablecoin to an address', async function () {
            await stablecoin.mint(deployer.address, "1" + wad);
            expect(await stablecoin.balanceOf(deployer.address)).to.be.equal("1" + wad);
        });
    });
    describe('--- burn()', function () {
        it('reverts: Stablecoin/burn-from-zero-address', async function () {
            await expect(stablecoin.burn(NULL_ADDRESS, "1" + wad)).to.be.revertedWith("Stablecoin/burn-from-zero-address");
        });
        it('reverts: Stablecoin/insufficient-balance', async function () {
            await expect(stablecoin.burn(deployer.address, "1" + wad)).to.be.revertedWith("Stablecoin/insufficient-balance");
        });
        it('reverts: Stablecoin/insufficient-allowance', async function () {
            await stablecoin.mint(signer1.address, "1" + wad);
            await expect(stablecoin.burn(signer1.address, "1" + wad)).to.be.revertedWith("Stablecoin/insufficient-allowance");
        });
        it('burns with allowance', async function () {
            await stablecoin.mint(signer1.address, "1" + wad);
            await stablecoin.connect(signer1).approve(deployer.address, "1" + wad);
            await stablecoin.burn(signer1.address, "1" + wad);
            expect(await stablecoin.balanceOf(signer1.address)).to.be.equal(0);
        });
        it('burns from address', async function () {
            await stablecoin.mint(signer1.address, "1" + wad);
            await stablecoin.connect(signer1).burn(signer1.address, "1" + wad);
            expect(await stablecoin.balanceOf(signer1.address)).to.be.equal(0);
        });
    });
    describe('--- transferFrom()', function () {
        it('reverts: Stablecoin/transfer-from-zero-address', async function () {
            await expect(stablecoin.transferFrom(NULL_ADDRESS, deployer.address, "1" + wad)).to.be.revertedWith("Stablecoin/transfer-from-zero-address");
        });
        it('reverts: Stablecoin/transfer-to-zero-address', async function () {
            await expect(stablecoin.transferFrom(deployer.address, NULL_ADDRESS, "1" + wad)).to.be.revertedWith("Stablecoin/transfer-to-zero-address");
        });
        it('reverts: Stablecoin/insufficient-balance', async function () {
            await expect(stablecoin.transferFrom(deployer.address, signer1.address, "1" + wad)).to.be.revertedWith("Stablecoin/insufficient-balance");
        });
        it('reverts: Stablecoin/insufficient-allowance', async function () {
            await stablecoin.mint(deployer.address, "1" + wad);
            await expect(stablecoin.connect(signer1).transferFrom(deployer.address, signer1.address, "1" + wad)).to.be.revertedWith("Stablecoin/insufficient-allowance");
        });
        it('transferFrom with allowance', async function () {
            await stablecoin.mint(deployer.address, "1" + wad);
            await stablecoin.approve(signer1.address, "1" + wad);
            await stablecoin.connect(signer1).transferFrom(deployer.address, signer1.address, "1" + wad);
            expect(await stablecoin.balanceOf(signer1.address)).to.be.equal("1" + wad);
        });
        it('transferFrom an address', async function () {
            await stablecoin.mint(deployer.address, "1" + wad);
            await stablecoin.connect(deployer).transferFrom(deployer.address, signer1.address, "1" + wad);
            expect(await stablecoin.balanceOf(signer1.address)).to.be.equal("1" + wad);
        });
    });
    describe('--- transfer()', function () {
        it('transfers to an address', async function () {
            await stablecoin.mint(deployer.address, "1" + wad);
            await stablecoin.transfer(signer1.address, "1" + wad);
            expect(await stablecoin.balanceOf(signer1.address)).to.be.equal("1" + wad);
        });
    });
    describe('--- push()', function () {
        it('pushes to an address', async function () {
            await stablecoin.mint(deployer.address, "1" + wad);
            await stablecoin.push(signer1.address, "1" + wad);
            expect(await stablecoin.balanceOf(signer1.address)).to.be.equal("1" + wad);
        });
    });
    describe('--- pull()', function () {
        it('pulls from an address', async function () {
            await stablecoin.mint(signer1.address, "1" + wad);
            await stablecoin.connect(signer1).approve(deployer.address, "1" + wad);
            await stablecoin.pull(signer1.address, "1" + wad);
            expect(await stablecoin.balanceOf(deployer.address)).to.be.equal("1" + wad);
        });
    });
    describe('--- move()', function () {
        it('move between addresses', async function () {
            await stablecoin.mint(deployer.address, "1" + wad);
            await stablecoin.move(deployer.address, signer1.address, "1" + wad);
            expect(await stablecoin.balanceOf(signer1.address)).to.be.equal("1" + wad);
        });
    });
    describe('--- increaseAllowance()', function () {
        it('increases allowance', async function () {
            await stablecoin.increaseAllowance(signer1.address, "1" + wad);
            expect(await stablecoin.allowance(deployer.address, signer1.address)).to.be.equal("1" + wad);
        });
    });
    describe('--- decreaseAllowance()', function () {
        it('reverts: Stablecoin/decreased-allowance-below-zero', async function () {
            await stablecoin.increaseAllowance(signer1.address, "1" + wad);
            await expect(stablecoin.decreaseAllowance(signer1.address, "2" + wad)).to.be.revertedWith("Stablecoin/decreased-allowance-below-zero");
        });
        it('decreases allowance', async function () {
            await stablecoin.increaseAllowance(signer1.address, "1" + wad);
            await stablecoin.decreaseAllowance(signer1.address, "1" + wad);
            expect(await stablecoin.allowance(deployer.address, signer1.address)).to.be.equal("0");
        });
    });
    describe('--- setSupplyCap()', function () {
        it('reverts: Stablecoin/more-supply-than-cap', async function () {
            await stablecoin.mint(deployer.address, "1" + wad);
            await expect(stablecoin.setSupplyCap("0")).to.be.revertedWith("Stablecoin/more-supply-than-cap");
        });
        it('sets the cap', async function () {
            await stablecoin.setSupplyCap("5" + wad);
            expect(await stablecoin.supplyCap()).to.be.equal("5" + wad);
        });
    });
    describe('--- updateDomainSeparator()', function () {
        it('sets domain separator', async function () {
            await stablecoin.updateDomainSeparator(1);
            let DS1 = await stablecoin.DOMAIN_SEPARATOR;
            let DS2 =await stablecoin.updateDomainSeparator(2);
            expect(DS1).to.not.be.equal(DS2);
        });
    });
    describe('--- approve()', function () {
        it('reverts: Stablecoin/approve-to-zero-address', async function () {
            await expect(stablecoin.approve(NULL_ADDRESS, 1)).to.be.revertedWith("Stablecoin/approve-to-zero-address");
        });
    });
});