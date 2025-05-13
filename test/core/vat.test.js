const { ethers, network } = require('hardhat');
const { expect } = require("chai");

describe('===Ledger===', function () {
    let deployer, signer1, signer2;

    let wad = "000000000000000000", // 18 Decimals
        ray = "000000000000000000000000000", // 27 Decimals
        rad = "000000000000000000000000000000000000000000000"; // 45 Decimals

    let collateral = ethers.utils.formatBytes32String("TEST");

    beforeEach(async function () {

        [deployer, signer1, signer2] = await ethers.getSigners();

        // Contract factory
        this.Ledger = await ethers.getContractFactory("Ledger");

        // Contract deployment
        ledger = await upgrades.deployProxy(this.Ledger, [], {initializer: "initialize"});
        await ledger.deployed();
    });

    describe('--- initialize()', function () {
        it('initialize', async function () {
            expect(await ledger.live()).to.be.equal("1");
        });
    });
    describe('--- rely()', function () {
        it('reverts: Ledger/not-authorized', async function () {
            await ledger.deny(deployer.address);
            await expect(ledger.rely(signer1.address)).to.be.revertedWith("Ledger/not-authorized");
            expect(await ledger.wards(signer1.address)).to.be.equal("0");
        });
        it('reverts: Ledger/not-live', async function () {
            await ledger.cage();
            await expect(ledger.rely(signer1.address)).to.be.revertedWith("Ledger/not-live");
            expect(await ledger.wards(signer1.address)).to.be.equal("0");
        });
        it('relies on address', async function () {
            await ledger.rely(signer1.address);
            expect(await ledger.wards(signer1.address)).to.be.equal("1");
        });
    });
    describe('--- deny()', function () {
        it('reverts: Ledger/not-authorized', async function () {
            await ledger.deny(deployer.address);
            await expect(ledger.deny(signer1.address)).to.be.revertedWith("Ledger/not-authorized");
        });
        it('reverts: Ledger/not-live', async function () {
            await ledger.cage();
            await expect(ledger.deny(signer1.address)).to.be.revertedWith("Ledger/not-live");
        });
        it('denies an address', async function () {
            await ledger.rely(signer1.address);
            expect(await ledger.wards(signer1.address)).to.be.equal("1");
            await ledger.deny(signer1.address);
            expect(await ledger.wards(signer1.address)).to.be.equal("0");
        });
    });
    describe('--- behalf()', function () {
        it('reverts: Ledger/not-authorized', async function () {
            await ledger.deny(deployer.address);
            await expect(ledger.behalf(signer1.address, signer2.address)).to.be.revertedWith("Ledger/not-authorized");
        });
        it('behalfs an address', async function () {
            expect(await ledger.can(signer1.address, signer2.address)).to.be.equal("0");
            await ledger.behalf(signer1.address, signer2.address);
            expect(await ledger.can(signer1.address, signer2.address)).to.be.equal("1");
        });
    });
    describe('--- regard()', function () {
        it('reverts: Ledger/not-authorized', async function () {
            await ledger.deny(deployer.address);
            await expect(ledger.behalf(signer1.address, signer2.address)).to.be.revertedWith("Ledger/not-authorized");
        });
        it('regards an address', async function () {
            await ledger.behalf(signer1.address, signer2.address);
            expect(await ledger.can(signer1.address, signer2.address)).to.be.equal("1");
            await ledger.regard(signer1.address, signer2.address);
            expect(await ledger.can(signer1.address, signer2.address)).to.be.equal("0");
        });
    });
    describe('--- hope()', function () {
        it('hopes on address', async function () {
            expect(await ledger.can(deployer.address, signer1.address)).to.be.equal("0");
            await ledger.hope(signer1.address);
            expect(await ledger.can(deployer.address, signer1.address)).to.be.equal("1");
        });
    });
    describe('--- nope()', function () {
        it('nopes on address', async function () {
            await ledger.hope(signer1.address);
            expect(await ledger.can(deployer.address, signer1.address)).to.be.equal("1");
            await ledger.nope(signer1.address);
            expect(await ledger.can(deployer.address, signer1.address)).to.be.equal("0");
        });
    });
    describe('--- wish()', function () {
        it('bit == usr', async function () {
            await ledger.hope(signer1.address);
            expect(await ledger.can(deployer.address, signer1.address)).to.be.equal("1");
            await ledger.nope(signer1.address);
            expect(await ledger.can(deployer.address, signer1.address)).to.be.equal("0");
        });
        it('can[bit][usr] == 1', async function () {
            await ledger.hope(signer1.address);
            expect(await ledger.can(deployer.address, signer1.address)).to.be.equal("1");
            await ledger.nope(signer1.address);
            expect(await ledger.can(deployer.address, signer1.address)).to.be.equal("0");
        });
    });
    describe('--- init()', function () {
        it('reverts: Ledger/ilk-already-init', async function () {
            await ledger.init(collateral);
            await expect(ledger.init(collateral)).to.be.revertedWith("Ledger/ilk-already-init");
        });
        it('initialize a new ilk', async function () {
            await ledger.init(collateral);
            expect(await ledger.ilks(collateral)).to.not.be.equal("0");
        });
    });
    describe('--- file(2)', function () {
        it('reverts: Ledger/not-live', async function () {
            await ledger.cage();
            await expect(ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "100" + rad)).to.be.revertedWith("Ledger/not-live");
        });
        it('reverts: Ledger/file-unrecognized-param', async function () {
            await expect(ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Lined"), "100" + rad)).to.be.revertedWith("Ledger/file-unrecognized-param");
        });
        it('sets Line', async function () {
            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "100" + rad);
            expect(await ledger.Line()).to.be.equal("100" + rad);
        });
    });
    describe('--- file(3)', function () {
        it('reverts: Ledger/not-live', async function () {
            await ledger.cage();
            await expect(ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("Line"), "100" + rad)).to.be.revertedWith("Ledger/not-live");
        });
        it('reverts: Ledger/file-unrecognized-param', async function () {
            await expect(ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("Lined"), "100" + rad)).to.be.revertedWith("Ledger/file-unrecognized-param");
        });
        it('sets vision', async function () {
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);
            expect(await (await ledger.ilks(collateral)).vision).to.be.equal("100" + ray);
        });
        it('sets line', async function () {
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "100" + rad);        
            expect(await (await ledger.ilks(collateral)).line).to.be.equal("100" + rad);
        });
        it('sets dust', async function () {
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "100" + rad);        
            expect(await (await ledger.ilks(collateral)).dust).to.be.equal("100" + rad);
        });
    });
    describe('--- slip()', function () {
        it('slips an amount', async function () {
            await ledger.slip(collateral, signer1.address, "10" + wad);
            expect(await ledger.gem(collateral, signer1.address)).to.be.equal("10" + wad);
        });
    });
    describe('--- flux()', function () {
        it('reverts: Ledger/not-allowed', async function () {
            await ledger.slip(collateral, signer1.address, "10" + wad);
            await expect(ledger.flux(collateral, signer1.address, signer2.address, "10" + wad)).to.be.revertedWith("Ledger/not-allowed");
        });
        it('flux an amount', async function () {
            await ledger.slip(collateral, deployer.address, "10" + wad);
            await ledger.flux(collateral, deployer.address, signer1.address, "10" + wad);
            expect(await ledger.gem(collateral, signer1.address)).to.be.equal("10" + wad);
        });
    });
    describe('--- move()', function () {
        it('reverts: Ledger/not-allowed', async function () {
            await expect(ledger.move(signer1.address, signer2.address, 0)).to.be.revertedWith("Ledger/not-allowed");
        });
        it('flux an amount', async function () {
            await ledger.init(collateral);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);

            await ledger.slip(collateral, deployer.address, "1" + wad);

            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, 0, "15" + wad);

            await ledger.move(deployer.address, signer1.address, "1" + rad);
            expect(await ledger.stablecoin(signer1.address)).to.be.equal("1" + rad);
        });
    });
    describe('--- frob()', function () {
        it('reverts: Ledger/not-allowed', async function () {
            await ledger.cage();
            await expect(ledger.frob(collateral, deployer.address, deployer.address, deployer.address, 0, 0)).to.be.revertedWith("Ledger/not-live");
        });
        it('reverts: Ledger/ilk-not-init', async function () {
            await expect(ledger.frob(collateral, deployer.address, deployer.address, deployer.address, 0, 0)).to.be.revertedWith("Ledger/ilk-not-init");
        });
        it('reverts: Ledger/ceiling-exceeded', async function () {
            await ledger.init(collateral);
            await expect(ledger.frob(collateral, deployer.address, deployer.address, deployer.address, 0, 1)).to.be.revertedWith("Ledger/ceiling-exceeded");
        });
        it('reverts: Ledger/not-safe', async function () {
            await ledger.init(collateral);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);        

            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "1" + ray);
            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            expect(await (await ledger.urns(collateral, deployer.address)).ink).to.be.equal("1" + wad);

            await expect(ledger.frob(collateral, deployer.address, deployer.address, deployer.address, 0, "199" + wad)).to.be.revertedWith("Ledger/not-safe");
        });
        it('reverts: Ledger/not-allowed-u', async function () {
            await ledger.init(collateral);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);        

            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);
            await ledger.slip(collateral, signer1.address, "1" + wad);
            await ledger.rely(signer1.address);
            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, "1" + wad, 0);
            await expect(ledger.frob(collateral, signer1.address, signer1.address, signer1.address, -1, 0)).to.be.revertedWith("Ledger/not-allowed-u");
        });
        it('reverts: Ledger/not-allowed-v', async function () {
            await ledger.init(collateral);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);        

            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);
            await ledger.slip(collateral, signer1.address, "1" + wad);
            await ledger.rely(signer1.address);
            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, "1" + wad, 0);
            await expect(ledger.frob(collateral, signer1.address, signer1.address, signer1.address, 10, 0)).to.be.revertedWith("Ledger/not-allowed-v");
        });
        it('reverts: Ledger/not-allowed-w', async function () {
            await ledger.init(collateral);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);        

            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);
            await ledger.slip(collateral, signer1.address, "1" + wad);
            await ledger.rely(signer1.address);
            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, "1" + wad, 0);
            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, 0, "10" + wad);
            await expect(ledger.frob(collateral, signer1.address, signer1.address, signer1.address, 0, "-1000000000000000000")).to.be.revertedWith("Ledger/not-allowed-w");
        });
        it('reverts: Ledger/dust', async function () {
            await ledger.init(collateral);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "100" + rad);              

            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);
            await ledger.slip(collateral, signer1.address, "1" + wad);
            await ledger.rely(signer1.address);
            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, "1" + wad, 0);
            await expect(ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, 0, "10" + wad)).to.be.revertedWith("Ledger/dust");
        });
        it('frobs collateral and frobs stablecoin', async function () {
            await ledger.init(collateral);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);

            await ledger.slip(collateral, signer1.address, "1" + wad);

            await ledger.rely(signer1.address);
            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, "1" + wad, 0);
            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, 0, "20" + wad);
            expect(await (await ledger.urns(collateral, signer1.address)).ink).to.be.equal("1" + wad);
            expect(await ledger.stablecoin(signer1.address)).to.be.equal("20" + rad);
        });
    });
    describe('--- fork()', function () {
        it('reverts: Ledger/not-allowed', async function () {
            await ledger.init(collateral);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);

            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.slip(collateral, signer1.address, "1" + wad);

            await ledger.rely(signer1.address);

            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, 0, "50" + wad);

            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, "1" + wad, 0);
            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, 0, "50" + wad);

            await expect(ledger.fork(collateral, deployer.address, signer1.address, 0, "10" + wad)).to.be.revertedWith("Ledger/not-allowed");

        });
        it('reverts: Ledger/not-safe-src Ledger/not-safe-dst', async function () {
            await ledger.init(collateral);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);

            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.slip(collateral, signer1.address, "1" + wad);

            await ledger.rely(signer1.address);

            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, 0, "30" + wad);

            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, "1" + wad, 0);
            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, 0, "80" + wad);
            
            await ledger.connect(deployer).hope(signer1.address);
            await ledger.connect(signer1).hope(deployer.address);

            await expect(ledger.fork(collateral, deployer.address, signer1.address, "1" + wad, 0)).to.be.revertedWith("Ledger/not-safe-src");
            await expect(ledger.fork(collateral, deployer.address, signer1.address, 0, "30" + wad)).to.be.revertedWith("Ledger/not-safe-dst");
        });
        it('reverts: Ledger/dust-src Ledger/dust-dst', async function () {
            await ledger.init(collateral);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);

            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.slip(collateral, signer1.address, "1" + wad);

            await ledger.rely(signer1.address);

            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, 0, "15" + wad);

            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, "1" + wad, 0);
            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, 0, "15" + wad);
            
            await ledger.connect(deployer).hope(signer1.address);
            await ledger.connect(signer1).hope(deployer.address);

            await expect(ledger.fork(collateral, deployer.address, signer1.address, 0, "10" + wad)).to.be.revertedWith("Ledger/dust-src");
            await expect(ledger.fork(collateral, deployer.address, signer1.address, 0, "-10" + wad)).to.be.revertedWith("Ledger/dust-dst");
        });
        it('forks between two addresses', async function () {
            await ledger.init(collateral);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);

            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.slip(collateral, signer1.address, "1" + wad);

            await ledger.rely(signer1.address);

            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, 0, "15" + wad);

            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, "1" + wad, 0);
            await ledger.connect(signer1).frob(collateral, signer1.address, signer1.address, signer1.address, 0, "15" + wad);
            
            await ledger.connect(deployer).hope(signer1.address);
            await ledger.connect(signer1).hope(deployer.address);

            await ledger.fork(collateral, deployer.address, signer1.address, 0, "1" + wad);
            expect(await (await ledger.urns(collateral, deployer.address)).art).to.be.equal("14" + wad);
        });
    });
    describe('--- grab()', function () {
        it('grabs ink and art of an address', async function () {
            await ledger.init(collateral);

            await ledger.connect(deployer)["file(bytes32,uint256)"](await ethers.utils.formatBytes32String("Line"), "200" + rad);
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("line"), "200" + rad);  
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("dust"), "10" + rad);              
            await ledger.connect(deployer)["file(bytes32,bytes32,uint256)"](collateral, await ethers.utils.formatBytes32String("vision"), "100" + ray);

            await ledger.slip(collateral, deployer.address, "1" + wad);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, "1" + wad, 0);
            await ledger.connect(deployer).frob(collateral, deployer.address, deployer.address, deployer.address, 0, "15" + wad);

            await ledger.rely(signer1.address);

            await ledger.connect(signer1).grab(collateral, deployer.address, deployer.address, deployer.address, "-1" + wad, "-15" + wad);
            expect(await (await ledger.urns(collateral, deployer.address)).art).to.be.equal(0);
            expect(await ledger.vice()).to.be.equal("15" + rad);
        });
    });
    describe('--- suck()', function () {
        it('sucks more stablecoin for an address for sin on another', async function () {
            await ledger.init(collateral);

            await ledger.suck(deployer.address, signer1.address, "10" + rad);
            expect(await ledger.stablecoin(signer1.address)).to.be.equal("10" + rad);
            expect(await ledger.vice()).to.be.equal("10" + rad);
        });
    });
    describe('--- heal()', function () {
        it('heals sin of a caller', async function () {
            await ledger.init(collateral);

            await ledger.suck(deployer.address, deployer.address, "10" + rad);
            expect(await ledger.stablecoin(deployer.address)).to.be.equal("10" + rad);
            expect(await ledger.vice()).to.be.equal("10" + rad);

            await ledger.heal("10" + rad);
            expect(await ledger.stablecoin(signer1.address)).to.be.equal(0);
            expect(await ledger.vice()).to.be.equal(0);
        });
    });
    describe('--- fold()', function () {
        it('reverts: Ledger/not-live', async function () {
            await ledger.cage();

            await expect(ledger.fold(collateral, deployer.address, "1" + ray)).to.be.revertedWith("Ledger/not-live");;
        });
        it('reverts: Ledger/not-live', async function () {
            await ledger.init(collateral);

            await ledger.fold(collateral, deployer.address, "1" + ray);
            expect(await (await ledger.ilks(collateral)).rate).to.be.equal("2" + ray);
        });
    });
    describe('--- uncage()', function () {
        it('uncages previouly caged', async function () {
            await ledger.cage();
            await ledger.uncage();
            expect(await ledger.live()).to.be.equal(1);
        });
    });
});