const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { joinSignature } = require('ethers/lib/utils');
const { ethers, network } = require('hardhat');
const Web3 = require('web3');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const DATA = "0x02";

describe('===Jar===', function () {
    let deployer, signer1, signer2, signer3, multisig;

    let ledger, 
        vision, 
        gemJoin, 
        fee,
        settlement,
        jar;

    let oracle;

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

        // Contract factory
        this.StablecoinJoin = await ethers.getContractFactory("StablecoinJoin");
        this.Ledger = await ethers.getContractFactory("Ledger");
        this.Stablecoin = await ethers.getContractFactory("Stablecoin");
        this.Jar = await ethers.getContractFactory("Jar");

        // Contract deployment
        ledger = await upgrades.deployProxy(this.Ledger, [], {initializer: "initialize"});
        await ledger.deployed();
        stablecoin = await upgrades.deployProxy(this.Stablecoin, [97, "STABLECOIN", "10000000" + wad], {initializer: "initialize"});
        await stablecoin.deployed();
        stablecoinjoin = await upgrades.deployProxy(this.StablecoinJoin, [ledger.address, stablecoin.address], {initializer: "initialize"});
        await stablecoinjoin.deployed();
        jar = await await upgrades.deployProxy(this.Jar, ["StakedStablecoin", "sSTABLECOIN", stablecoin.address, 10, 0, 5], {initializer: "initialize"});
        await jar.deployed();


        // Initialize
        await ledger.init(collateral);
        await ledger.rely(stablecoinjoin.address);
        await stablecoin.rely(stablecoinjoin.address);
        await ledger.hope(stablecoinjoin.address);

        await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "5000" + rad);
        await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "5000" + rad);  
        await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
        await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);

        await ledger.slip(collateral, deployer.address, "100" + wad);
        await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "100" + wad, 0);
        await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, 0, "2500" + wad);
        await stablecoinjoin.exit(deployer.address,"100" + wad);
        await stablecoinjoin.exit(signer1.address, "400" + wad);
        await stablecoinjoin.exit(signer2.address, "800" + wad);
        await stablecoinjoin.exit(signer3.address, "1200" + wad);
    });

    describe('--- Setters', function () {
        it('checks setters', async function () {
            await expect(jar.setSpread("0")).to.be.revertedWith("Jar/duration-non-zero");
            await jar.setSpread("10");
            expect(await jar.spread()).to.be.equal("10");

            await jar.setExitDelay("0");
            expect(await jar.exitDelay()).to.be.equal("0");

            await jar.addOperator(signer1.address);
            expect(await jar.operators(signer1.address)).to.be.equal("1");

            await jar.removeOperator(signer1.address);
            expect(await jar.operators(signer1.address)).to.be.equal("0");        
        });
    });
    describe('--- Extract Dust and Cage', function () {
        it('checks extracting dust', async function () {
            // Extract Dust
            expect(await stablecoin.balanceOf(jar.address)).to.be.equal("0");
            await stablecoin.transfer(jar.address, "10" + wad);
            expect(await stablecoin.balanceOf(jar.address)).to.be.equal("10" + wad);
            await jar.extractDust();
            expect(await stablecoin.balanceOf(jar.address)).to.be.equal("0");

            await stablecoin.connect(deployer).approve(jar.address, "10" + wad)
            await jar.connect(deployer).replenish("10" + wad, true);
            await expect(jar.extractDust()).to.be.revertedWith("Jar/in-distribution");
        });
    });
    describe('--- cage()', function () {
        it('denies an address', async function () {
            await jar.cage();
            expect(await jar.live()).to.be.equal("0");
        });
    });   
    describe('--- uncage()', function () {
        it('uncages previouly caged', async function () {
            await jar.cage();
            await jar.uncage();
            expect(await jar.live()).to.be.equal(1);
        });
    });
    describe('--- rely()', function () {
        it('reverts: Jar/not-authorized', async function () {
            await expect(jar.connect(signer1).rely(signer1.address)).to.be.revertedWith("Jar/not-authorized");
            expect(await jar.wards(signer1.address)).to.be.equal("0");
        });
        it('relies on address', async function () {
            await jar.rely(signer1.address);
            expect(await jar.wards(signer1.address)).to.be.equal("1");
        });
    });
    describe('--- deny()', function () {
        it('reverts: Jar/not-authorized', async function () {
            await expect(jar.connect(signer1).deny(signer1.address)).to.be.revertedWith("Jar/not-authorized");
        });
        it('denies an address', async function () {
            await jar.rely(signer1.address);
            expect(await jar.wards(signer1.address)).to.be.equal("1");
            await jar.deny(signer1.address);
            expect(await jar.wards(signer1.address)).to.be.equal("0");
        });
    });

    describe('---Full Flow', function () {
        it('reverts: Jar/not-live', async function () {
            await jar.cage();
            await expect(jar.connect(signer2).join("100" + wad)).to.be.revertedWith("Jar/not-live");
            await expect(jar.connect(signer2).exit("100" + wad)).to.be.revertedWith("Jar/not-live");
            await expect(jar.connect(signer2).redeemBatch([signer1.address])).to.be.revertedWith("Jar/not-live");
        });
        it('checks join/exit flow', async function () {

            await network.provider.send("evm_setAutomine", [false]);
            let tau;

            {
                tau = (await ethers.provider.getBlock()).timestamp;
                await network.provider.send("evm_setNextBlockTimestamp", [tau + 1]);
                await network.provider.send("evm_mine");
                // console.log((await ethers.provider.getBlock()).timestamp)
            }

            {
                tau = (await ethers.provider.getBlock()).timestamp;
                await network.provider.send("evm_setNextBlockTimestamp", [tau + 1]);

                ledger.connect(signer1).hope(stablecoinjoin.address);
                await stablecoin.connect(signer1).approve(jar.address, "50" + wad);
                await jar.connect(signer1).join("50" + wad); 

                await network.provider.send("evm_mine"); // PreJoin

                tau = (await ethers.provider.getBlock()).timestamp;
                await network.provider.send("evm_setNextBlockTimestamp", [tau + 10]);

                await stablecoin.connect(deployer).approve(jar.address, "10" + wad)
                await jar.connect(deployer).replenish("10" + wad, true);

                await network.provider.send("evm_mine"); // 0th second

                expect(await stablecoin.balanceOf(jar.address)).to.be.equal("60" + wad);

                tau = (await ethers.provider.getBlock()).timestamp;
                await network.provider.send("evm_setNextBlockTimestamp", [tau + 5]);

                await stablecoin.connect(signer2).approve(jar.address, "100" + wad);
                await jar.connect(signer2).join("100" + wad);

                await network.provider.send("evm_mine"); // 5th

                expect(await jar.earned(signer1.address)).to.equal("5000000000000000000");

                tau = (await ethers.provider.getBlock()).timestamp;
                await network.provider.send("evm_setNextBlockTimestamp", [tau + 15]);
                                
                await stablecoin.connect(deployer).approve(jar.address, "10" + wad)
                await jar.connect(deployer).replenish("10" + wad, true);

                await network.provider.send("evm_mine"); // 0th

                expect(await jar.earned(signer1.address)).to.equal("6666666666666666650");
                expect(await jar.earned(signer2.address)).to.equal("3333333333333333300");

                tau = (await ethers.provider.getBlock()).timestamp;
                await network.provider.send("evm_setNextBlockTimestamp", [tau + 15]);
                                
                await stablecoin.connect(deployer).approve(jar.address, "10" + wad)
                await jar.connect(deployer).replenish("10" + wad, true);

                await jar.connect(signer2).exit("50" + wad);
                await jar.connect(signer2).exit("0" + wad);

                await network.provider.send("evm_mine"); // 0th

                expect(await jar.earned(signer1.address)).to.equal("9999999999999999950");
                expect(await jar.earned(signer2.address)).to.equal("0"); // Got rewards with exit previously

                tau = (await ethers.provider.getBlock()).timestamp;
                await network.provider.send("evm_setNextBlockTimestamp", [tau + 10]);
                                
                await jar.connect(signer1).exit("50" + wad);

                await jar.connect(signer2).exit("50" + wad);

                await network.provider.send("evm_mine"); // 10th

                expect(await jar.rewards(signer1.address)).to.equal("0");
                expect(await jar.rewards(signer2.address)).to.equal("0");

                expect(await stablecoin.balanceOf(signer1.address)).to.be.equal("414999999999999999950");
                expect(await stablecoin.balanceOf(signer2.address)).to.be.equal("814999999999999999900");

                tau = (await ethers.provider.getBlock()).timestamp;
                await network.provider.send("evm_setNextBlockTimestamp", [tau + 10]);

                await stablecoin.connect(deployer).approve(jar.address, "30" + wad)
                await jar.connect(deployer).replenish("10" + wad, true);
                await jar.connect(deployer).replenish("10" + wad, false);

                await network.provider.send("evm_mine"); // 0th

                expect(await jar.rate()).to.be.equal("2" + wad);

                tau = (await ethers.provider.getBlock()).timestamp;
                await network.provider.send("evm_setNextBlockTimestamp", [tau + 10]);

                await jar.setExitDelay("5");
                await stablecoin.connect(deployer).approve(jar.address, "30" + wad)
                await jar.connect(deployer).replenish("10" + wad, true);

                await stablecoin.connect(signer1).approve(jar.address, "10" + wad);
                await jar.connect(signer1).join("10" + wad);

                await network.provider.send("evm_mine"); // 0th 
                
                tau = (await ethers.provider.getBlock()).timestamp;
                await network.provider.send("evm_setNextBlockTimestamp", [tau + 10]);


                await network.provider.send("evm_mine"); // 10th 

                tau = (await ethers.provider.getBlock()).timestamp;
                await network.provider.send("evm_setNextBlockTimestamp", [tau + 10]);
                await jar.connect(signer1).exit("10" + wad);
                await jar.connect(signer1).redeemBatch([signer1.address]);

                await network.provider.send("evm_mine");

                await network.provider.send("evm_setAutomine", [true]);
            }
        });
    });
});