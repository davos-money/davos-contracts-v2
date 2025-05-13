const { ethers, network } = require('hardhat');
const { expect } = require("chai");

describe('===GemJoin===', function () {
    let deployer, signer1, signer2;

    let wad = "000000000000000000", // 18 Decimals
        ray = "000000000000000000000000000", // 27 Decimals
        rad = "000000000000000000000000000000000000000000000"; // 45 Decimals

    let collateral = ethers.utils.formatBytes32String("TEST");

    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

    beforeEach(async function () {

        [deployer, signer1, signer2] = await ethers.getSigners();

        // Contract factory
        this.GemJoin = await ethers.getContractFactory("GemJoin");
        this.Ledger = await ethers.getContractFactory("Ledger");
        this.Stablecoin = await ethers.getContractFactory("Stablecoin");

        // Contract deployment
        ledger = await upgrades.deployProxy(this.Ledger, [], {initializer: "initialize"});
        await ledger.deployed();
        gem = await upgrades.deployProxy(this.Stablecoin, [97, "GEM", "100" + wad], {initializer: "initialize"});
        await gem.deployed();
        gemjoin = await upgrades.deployProxy(this.GemJoin, [ledger.address, collateral, gem.address], {initializer: "initialize"});
        await gemjoin.deployed();
    });

    describe('--- initialize()', function () {
        it('initialize', async function () {
            expect(await gemjoin.ledger()).to.be.equal(ledger.address);
        });
    });
    describe('--- rely()', function () {
        it('reverts: GemJoin/not-authorized', async function () {
            await gemjoin.deny(deployer.address);
            await expect(gemjoin.rely(signer1.address)).to.be.revertedWith("GemJoin/not-authorized");
            expect(await gemjoin.wards(signer1.address)).to.be.equal("0");
        });
        it('relies on address', async function () {
            await gemjoin.rely(signer1.address);
            expect(await gemjoin.wards(signer1.address)).to.be.equal("1");
        });
    });
    describe('--- deny()', function () {
        it('reverts: GemJoin/not-authorized', async function () {
            await gemjoin.deny(deployer.address);
            await expect(gemjoin.deny(signer1.address)).to.be.revertedWith("GemJoin/not-authorized");
        });
        it('denies an address', async function () {
            await gemjoin.rely(signer1.address);
            expect(await gemjoin.wards(signer1.address)).to.be.equal("1");
            await gemjoin.deny(signer1.address);
            expect(await gemjoin.wards(signer1.address)).to.be.equal("0");
        });
    });
    describe('--- cage()', function () {
        it('cages', async function () {
            await gemjoin.cage();
            expect(await gemjoin.live()).to.be.equal("0");
        });
    });
    describe('--- join()', function () {
        it('reverts: GemJoin/not-live', async function () {
            await gemjoin.cage();
            await expect(gemjoin.join(deployer.address, "1" + wad)).to.be.revertedWith("GemJoin/not-live");
        });
        it('reverts: GemJoin/overflow', async function () {
            await expect(gemjoin.join(deployer.address, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")).to.be.revertedWith("GemJoin/overflow");
        });
        it('joins stablecoin erc20', async function () {
            await gem.mint(deployer.address, "1" + wad);
            await gem.approve(gemjoin.address, "1" + wad);
            await ledger.rely(gemjoin.address);
            await gem.rely(gemjoin.address);

            await gemjoin.join(deployer.address, "1" + wad);
            expect(await ledger.gem(collateral, deployer.address)).to.be.equal("1" + wad);
        });
    });
    describe('--- exit()', function () {
        it('reverts: GemJoin/overflow', async function () {
            await expect(gemjoin.exit(deployer.address, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")).to.be.revertedWith("GemJoin/overflow");
        });
        it('exits stablecoin erc20', async function () {
            await gem.mint(deployer.address, "1" + wad);
            await gem.approve(gemjoin.address, "1" + wad);
            await ledger.rely(gemjoin.address);
            await gem.rely(gemjoin.address);

            await gemjoin.join(deployer.address, "1" + wad);
            expect(await ledger.gem(collateral, deployer.address)).to.be.equal("1" + wad);

            await gemjoin.exit(deployer.address, "1" + wad);
            expect(await ledger.gem(collateral, deployer.address)).to.be.equal("0");
        });
    });
    describe('--- uncage()', function () {
        it('uncages previouly caged', async function () {
            await gemjoin.cage();
            await gemjoin.uncage();
            expect(await gemjoin.live()).to.be.equal(1);
        });
    });
});
describe('===StablecoinJoin===', function () {
    let deployer, signer1, signer2;

    let wad = "000000000000000000", // 18 Decimals
        ray = "000000000000000000000000000", // 27 Decimals
        rad = "000000000000000000000000000000000000000000000"; // 45 Decimals

    let collateral = ethers.utils.formatBytes32String("TEST");

    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

    beforeEach(async function () {

        [deployer, signer1, signer2] = await ethers.getSigners();

        // Contract factory
        this.StablecoinJoin = await ethers.getContractFactory("StablecoinJoin");
        this.Ledger = await ethers.getContractFactory("Ledger");
        this.Stablecoin = await ethers.getContractFactory("Stablecoin");

        // Contract deployment
        ledger = await upgrades.deployProxy(this.Ledger, [], {initializer: "initialize"});
        await ledger.deployed();
        stablecoin = await upgrades.deployProxy(this.Stablecoin, [97, "STABLECOIN", "100" + wad], {initializer: "initialize"});
        await stablecoin.deployed();
        stablecoinjoin = await upgrades.deployProxy(this.StablecoinJoin, [ledger.address, stablecoin.address], {initializer: "initialize"});
        await stablecoinjoin.deployed();
    });

    describe('--- initialize()', function () {
        it('initialize', async function () {
            expect(await stablecoinjoin.ledger()).to.be.equal(ledger.address);
        });
    });
    describe('--- rely()', function () {
        it('reverts: StablecoinJoin/not-authorized', async function () {
            await stablecoinjoin.deny(deployer.address);
            await expect(stablecoinjoin.rely(signer1.address)).to.be.revertedWith("StablecoinJoin/not-authorized");
            expect(await stablecoinjoin.wards(signer1.address)).to.be.equal("0");
        });
        it('relies on address', async function () {
            await stablecoinjoin.rely(signer1.address);
            expect(await stablecoinjoin.wards(signer1.address)).to.be.equal("1");
        });
    });
    describe('--- deny()', function () {
        it('reverts: StablecoinJoin/not-authorized', async function () {
            await stablecoinjoin.deny(deployer.address);
            await expect(stablecoinjoin.deny(signer1.address)).to.be.revertedWith("StablecoinJoin/not-authorized");
        });
        it('denies an address', async function () {
            await stablecoinjoin.rely(signer1.address);
            expect(await stablecoinjoin.wards(signer1.address)).to.be.equal("1");
            await stablecoinjoin.deny(signer1.address);
            expect(await stablecoinjoin.wards(signer1.address)).to.be.equal("0");
        });
    });
    describe('--- cage()', function () {
        it('cages', async function () {
            await stablecoinjoin.cage();
            expect(await stablecoinjoin.live()).to.be.equal("0");
        });
    });
    describe('--- join()', function () {
        it('joins stablecoin erc20', async function () {
            await ledger.init(collateral);
            await ledger.rely(stablecoinjoin.address);
            await stablecoin.rely(stablecoinjoin.address);
            await ledger.hope(stablecoinjoin.address);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);

            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, 0, "15" + wad);
            await stablecoinjoin.exit(deployer.address, "1" + wad);

            await stablecoin.approve(stablecoinjoin.address, "1" + wad);
            
            await stablecoinjoin.join(deployer.address, "1" + wad);
            expect(await ledger.stablecoin(deployer.address)).to.be.equal("15" + rad);
        });
    });
    describe('--- exit()', function () {
        it('reverts: StablecoinJoin/not-live', async function () {
            await stablecoinjoin.cage();
            await expect(stablecoinjoin.exit(deployer.address, "1" + wad)).to.be.revertedWith("StablecoinJoin/not-live");
        });
        it('exits stablecoin erc20', async function () {
            await ledger.init(collateral);
            await ledger.rely(stablecoinjoin.address);
            await stablecoin.rely(stablecoinjoin.address);
            await ledger.hope(stablecoinjoin.address);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);

            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, 0, "15" + wad);
            await stablecoinjoin.exit(signer1.address, "1" + wad);

            expect(await stablecoin.balanceOf(signer1.address)).to.be.equal("1" + wad);
        });
    });
    describe('--- uncage()', function () {
        it('uncages previouly caged', async function () {
            await stablecoinjoin.cage();
            await stablecoinjoin.uncage();
            expect(await stablecoinjoin.live()).to.be.equal(1);
        });
    });
});