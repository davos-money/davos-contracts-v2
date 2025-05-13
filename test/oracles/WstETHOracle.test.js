const { ethers, network, upgrades} = require('hardhat');
const { expect } = require("chai");
const {BigNumber} = require("ethers");

describe('CollateralOracle', function () {
    let deployer, signer1, signer2;

    let oracle, mVault, token, yieldModule;

    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    const ST_ETH_PRICE = '100000000000';
    const ST_ETH_PRICE_18_DECIMALS = ST_ETH_PRICE + '0000000000'

    beforeEach(async function () {

        [deployer, signer1, signer2] = await ethers.getSigners();

        // Contract factory
        this.CollateralOracle = await ethers.getContractFactory("CollateralOracle");
        this.AggregatorV3 = await ethers.getContractFactory("MockAggregator");
        this.Token = await ethers.getContractFactory("Token");
        this.MasterVaultV2 = await ethers.getContractFactory("MasterVault");
        this.PriceController = await ethers.getContractFactory("PriceController");
        this.Licensor = await ethers.getContractFactory("Licensor");
        this.YieldModule = await ethers.getContractFactory("YieldModule");

        const aggregator = await this.AggregatorV3.deploy(ST_ETH_PRICE); // price is 1000.00000000
        await aggregator.deployed()
        token = await upgrades.deployProxy(this.Token, ["Wrapped Staked Ether", "wstETH"], {initializer: "initialize"});
        await token.deployed();
        mVault = await upgrades.deployProxy(this.MasterVaultV2, ["Master Vault Token", "ceETH", token.address], {initializer: "initialize"});
        await mVault.deployed();
        // await mVault.changeYieldHeritor(deployer.address);

        const pc = await upgrades.deployProxy(this.PriceController, [], {initializer: "initialize"});
        await pc.deployed();
        await pc.setToken(token.address, 'getStETHByWstETH(uint256)', 'getWstETHByStETH(uint256)', '', false);

        oracle = await upgrades.deployProxy(this.CollateralOracle, [aggregator.address, token.address, mVault.address, pc.address], {initializer: "initialize"});
        await oracle.deployed();

        licensor = await upgrades.deployProxy(this.Licensor, [deployer.address, 0, 0], {initializer: "initialize"});

        yieldModule = await upgrades.deployProxy(this.YieldModule, [mVault.address, licensor.address, 1000], {initializer: "initialize"});
        await yieldModule.changePriceController(pc.address);

        await mVault.addModule(yieldModule.address, "0x");

    });

    describe('general', function () {
        it('initial price is equal', async function () {
            const peek = await oracle.peek();
            expect(BigNumber.from(peek[0]).toString()).to.be.eq(ST_ETH_PRICE_18_DECIMALS);
        });

        it('wst eth ratio changed', async () => {
            await token.setRatio("950000000000000000");
            const peek = await oracle.peek();
            expect(BigNumber.from(peek[0]).toString()).to.be.eq('1052631578947368421000'); // 1000 / 0.95
        });

        it('master vault changes does not affect the price', async () => {
          const amount = ethers.utils.parseEther('1');
          await token.setRatio("1000000000000000000");

          await mVault.changeProvider(signer1.address);
          await token.mint(signer1.address, ethers.utils.parseEther('10'));
          await token.connect(signer1).approve(mVault.address, ethers.utils.parseEther('10'));
          await mVault.connect(signer1).deposit(amount, signer1.address);

          let peek = await oracle.peek();
          expect(BigNumber.from(peek[0]).toString()).to.be.eq(ST_ETH_PRICE_18_DECIMALS);

          await token.setRatio("900000000000000000");
          peek = await oracle.peek();
          expect(BigNumber.from(peek[0].toString())).to.be.eq('1100000000000000001001'); // 1100.000000000000001001 USD

          await token.setRatio("800000000000000000");
          peek = await oracle.peek();
          expect(BigNumber.from(peek[0]).toString()).to.be.eq('1225000000000000000000'); // 1225.000000000000000000 USD

          await yieldModule.claimYield();
          peek = await oracle.peek();
          expect(BigNumber.from(peek[0]).toString()).to.be.eq('1225000000000000000000'); // 1225.000000000000000000 USD

          // withdraw
          await mVault.connect(signer1).redeem(ethers.utils.parseEther('0.1'), signer1.address, signer1.address);
          peek = await oracle.peek();
          expect(BigNumber.from(peek[0]).toString()).to.be.eq('1225000000000000000000', 'wrong price after redeem');
        });
    });
});