const { ethers, network } = require('hardhat');
const { expect } = require("chai");

describe('===Settlement===', function () {
    let deployer, signer1, signer2;

    let wad = "000000000000000000", // 18 Decimals
        ray = "000000000000000000000000000", // 27 Decimals
        rad = "000000000000000000000000000000000000000000000"; // 45 Decimals

    let collateral = ethers.utils.formatBytes32String("TEST");

    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

    beforeEach(async function () {

        [deployer, signer1, signer2] = await ethers.getSigners();

        // Contract factory
        this.Settlement = await ethers.getContractFactory("Settlement");
        this.Ledger = await ethers.getContractFactory("Ledger");
        this.StablecoinJoin = await ethers.getContractFactory("StablecoinJoin");
        this.Stablecoin = await ethers.getContractFactory("Stablecoin");

        // Contract deployment
        ledger = await upgrades.deployProxy(this.Ledger, [], {initializer: "initialize"});
        await ledger.deployed();
        stablecoin = await upgrades.deployProxy(this.Stablecoin, ["97", "STABLECOIN", "100" + wad], {initializer: "initialize"});
        await stablecoin.deployed();
        stablecoinJoin = await upgrades.deployProxy(this.StablecoinJoin, [ledger.address, stablecoin.address], {initializer: "initialize"});
        await stablecoinJoin.deployed();
        settlement = await upgrades.deployProxy(this.Settlement, [ledger.address, stablecoinJoin.address, deployer.address], {initializer: "initialize"});
        await settlement.deployed();
    });

    describe('--- initialize()', function () {
        it('initialize', async function () {
            expect(await settlement.live()).to.be.equal("1");
        });
    });
    describe('--- rely()', function () {
        it('reverts: Settlement/not-authorized', async function () {
            await settlement.deny(deployer.address);
            await expect(settlement.rely(signer1.address)).to.be.revertedWith("Settlement/not-authorized");
            expect(await settlement.wards(signer1.address)).to.be.equal("0");
        });
        it('reverts: Settlement/not-live', async function () {
            await settlement.cage();
            await expect(settlement.rely(signer1.address)).to.be.revertedWith("Settlement/not-live");
            expect(await settlement.wards(signer1.address)).to.be.equal("0");
        });
        it('relies on address', async function () {
            await settlement.rely(signer1.address);
            expect(await settlement.wards(signer1.address)).to.be.equal("1");
        });
    });
    describe('--- deny()', function () {
        it('reverts: Settlement/not-authorized', async function () {
            await settlement.deny(deployer.address);
            await expect(settlement.deny(signer1.address)).to.be.revertedWith("Settlement/not-authorized");
        });
        it('denies an address', async function () {
            await settlement.rely(signer1.address);
            expect(await settlement.wards(signer1.address)).to.be.equal("1");
            await settlement.deny(signer1.address);
            expect(await settlement.wards(signer1.address)).to.be.equal("0");
        });
    });
    describe('--- file(2a)', function () {
        it('reverts: Settlement/not-authorized', async function () {
            await settlement.deny(deployer.address);
            await expect(settlement.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("humpy"), "100" + rad)).to.be.revertedWith("Settlement/not-authorized");
        });
        it('reverts: Settlement/file-unrecognized-param', async function () {
            await expect(settlement.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("humpy"), "100" + rad)).to.be.revertedWith("Settlement/file-unrecognized-param");
        });
        it('sets hump', async function () {
            await settlement.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("hump"), "100" + rad);
            expect(await settlement.hump()).to.be.equal("100" + rad);
        });
    });
    describe('--- file(2b)', function () {
        it('reverts: Settlement/not-authorized', async function () {
            await settlement.deny(deployer.address);
            await expect(settlement.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("new"), deployer.address)).to.be.revertedWith("Settlement/not-authorized");
        });
        it('reverts: Settlement/file-unrecognized-param', async function () {
            await expect(settlement.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("new"), deployer.address)).to.be.revertedWith("Settlement/file-unrecognized-param");
        });
        it('sets multisig', async function () {
            await settlement.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("multisig"), signer1.address);
            expect(await settlement.multisig()).to.be.equal(signer1.address);
        });
        it('sets stablecoinJoin', async function () {
            await settlement.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("stablecoinjoin"), stablecoinJoin.address);
            expect(await settlement.stablecoinJoin()).to.be.equal(stablecoinJoin.address);
        });
        it('sets stablecoin', async function () {
            await settlement.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("stablecoin"), stablecoin.address);
            expect(await settlement.stablecoin()).to.be.equal(stablecoin.address);
        });
        it('sets ledger', async function () {
            await settlement.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("ledger"), ledger.address);
            expect(await settlement.ledger()).to.be.equal(ledger.address);
        });
    });
    describe('--- heal()', function () {
        it('reverts: Settlement/insufficient-surplus', async function () {
            await expect(settlement.heal("1" + rad)).to.be.revertedWith("Settlement/insufficient-surplus");
        });
        it('reverts: Settlement/insufficient-debt', async function () {
            await ledger.init(collateral);
            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);
            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, settlement.address, 0, "15" + wad);

            await expect(settlement.heal("1" + rad)).to.be.revertedWith("Settlement/insufficient-debt");
        });
        it('heals ledger contract', async function () {
            await ledger.init(collateral);
            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);
            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, settlement.address, 0, "15" + wad);
            await ledger.rely(signer1.address);
            await ledger.connect(signer1).grab(collateral, deployer.address, deployer.address, settlement.address, "-1" + wad, "-15" + wad);
            expect(await ledger.sin(settlement.address)).to.be.equal("15" + rad);
            expect(await ledger.stablecoin(settlement.address)).to.be.equal("15" + rad);

            await settlement.heal("10" + rad);
            expect(await ledger.sin(settlement.address)).to.be.equal("5" + rad);
            expect(await ledger.stablecoin(settlement.address)).to.be.equal("5" + rad);
        });
    });
    describe('--- feed()', function () {
        it('feeds surplus stablecoin to settlement', async function () {
            await ledger.init(collateral);
            await ledger.rely(settlement.address);
            await ledger.rely(stablecoinJoin.address);
            await ledger.hope(stablecoinJoin.address);
            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);
            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, 0, "15" + wad);

            await settlement.connect(deployer)["file(bytes32,address)"](await ethers.utils.formatBytes32String("stablecoin"), stablecoin.address);
            await stablecoin.connect(deployer).rely(stablecoinJoin.address);
            await stablecoinJoin.connect(deployer).rely(settlement.address);
            await stablecoinJoin.connect(deployer).exit(deployer.address, "10" + wad);
            expect(await stablecoin.balanceOf(deployer.address)).to.be.equal("10" + wad);

            await stablecoin.connect(deployer).approve(settlement.address, "10" + wad);
            await settlement.connect(deployer).feed("10" + wad);
            expect(await ledger.stablecoin(settlement.address)).to.be.equal("10" + rad);
        });
    });
    describe('--- flap()', function () {
        it('reverts: Settlement/insufficient-surplus', async function () {
            await ledger.init(collateral);
            await ledger.rely(settlement.address);
            await ledger.rely(stablecoinJoin.address);
            await ledger.hope(stablecoinJoin.address);
            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);
            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, 0, "15" + wad);
            await ledger.connect(deployer).move(deployer.address, settlement.address, "10" + rad);
            await ledger.rely(signer1.address);
            await ledger.connect(signer1).grab(collateral, deployer.address, deployer.address, settlement.address, "-1" + wad, "-15" + wad);

            await expect(settlement.flap()).to.be.revertedWith("Settlement/insufficient-surplus");
        });
        it('flaps stablecoin to multisig', async function () {
            await ledger.init(collateral);
            await ledger.rely(settlement.address);
            await ledger.rely(stablecoinJoin.address);
            await ledger.hope(stablecoinJoin.address);
            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);
            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, settlement.address, 0, "15" + wad);
            
            await stablecoinJoin.rely(settlement.address);
            await stablecoin.rely(stablecoinJoin.address);

            await settlement.flap();
            expect(await stablecoin.balanceOf(deployer.address)).to.be.equal("15" + wad);
        });
    });
    describe('--- cage()', function () {
        it('reverts: Settlement/not-live', async function () {
            await settlement.cage();
            await expect(settlement.cage()).to.be.revertedWith("Settlement/not-live");
        });
    });
    describe('--- uncage()', function () {
        it('uncages previouly caged', async function () {
            await settlement.cage();
            await settlement.uncage();
            await expect(settlement.uncage()).to.be.revertedWith("Settlement/live");
        });
    });
});