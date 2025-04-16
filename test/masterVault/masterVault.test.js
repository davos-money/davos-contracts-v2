const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { joinSignature } = require('ethers/lib/utils');
const { ethers, network } = require('hardhat');
const Web3 = require('web3');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const DATA = "0x02";

describe('===MasterVault_V2===', function () {
    let deployer, signer1, signer2, signer3, signer4, yieldHeritor;

    let token,
        mv;
    let wad = "000000000000000000", // 18 Decimals
        ray = "000000000000000000000000000", // 27 Decimals
        rad = "000000000000000000000000000000000000000000000", // 45 Decimals
        ONE = 10 ** 27;


    let collateral = ethers.utils.formatBytes32String("aMATICc");

    beforeEach(async function () {

        [deployer, signer1, signer2, signer3, signer4, yieldHeritor] = await ethers.getSigners();

        // Contract factory
        this.Token = await ethers.getContractFactory("Token");
        this.MasterVault_V2 = await ethers.getContractFactory("MasterVault");
        this.Licensor = await ethers.getContractFactory("Licensor");
        this.YieldModule = await ethers.getContractFactory("YieldModule");
        this.RatioAdapter = await ethers.getContractFactory("RatioAdapter");

        // Contract deployment
        token = await upgrades.deployProxy(this.Token, ["Wrapped Staked Ether", "wstETH"], {initializer: "initialize"});
        await token.deployed();
        await token.setRatio("950000000000000000");
        mv = await upgrades.deployProxy(this.MasterVault_V2, ["Master Vault Token", "ceMATIC", token.address], {initializer: "initialize"});
        await mv.deployed();

        const adapter = await upgrades.deployProxy(this.RatioAdapter, [], {initializer: "initialize"});
        await adapter.deployed();
        await adapter.setToken(token.address, 'getStETHByWstETH(uint256)', 'getWstETHByStETH(uint256)', '', false);

        const licensor = await upgrades.deployProxy(this.Licensor, [deployer.address, 0, 0], {initializer: "initialize"});

        const yieldModule = await upgrades.deployProxy(this.YieldModule, [licensor.address, 0], {initializer: "initialize"});
        await yieldModule.changeAdapter(adapter.address);
    });

    describe('--- General', function () {

        it('redeem not changed after claim', async () => {
          await mv.changeYieldHeritor(yieldHeritor.address);
          await mv.changeProvider(signer1.address);

          await token.mint(signer1.address, ethers.utils.parseEther('10000'));
          await token.connect(signer1).approve(mv.address, ethers.utils.parseEther('10000'));
          await mv.connect(signer1).deposit(ethers.utils.parseEther('10000'), signer1.address);

          await token.setRatio("940000000000000000");

          const redeemAmBefore = await mv.previewRedeem(ethers.utils.parseEther('10000'));

          let vy = await mv.getVaultYield();
          expect(vy.toString()).to.be.eq('10526315789473684209') // 10.526315789473684209

          await mv.claimYield();

          const redeemAmAfter = await mv.previewRedeem(ethers.utils.parseEther('10000'))

          expect(redeemAmBefore.toString()).to.be.eq(redeemAmAfter.toString(), 'redeem result changed after claim');
          expect(redeemAmAfter.toString()).to.be.eq(BigNumber.from(ethers.utils.parseEther('10000')).sub(vy), 'redeem amount is wrong')
        })

        it('deposit/withdrawal is possible', async () => {
          await mv.changeYieldHeritor(yieldHeritor.address);
          await mv.changeProvider(signer1.address);

          await token.mint(signer1.address, ethers.utils.parseEther('1000'));
          await token.connect(signer1).approve(mv.address, ethers.utils.parseEther('1000'));
          await mv.connect(signer1).deposit(ethers.utils.parseEther('1'), signer1.address);

          let vy = await mv.getVaultYield();
          expect(vy.toString()).to.be.eq('0', 'initial yield not zero');

          await token.setRatio("920000000000000000");

          vy = await mv.getVaultYield();
          expect(vy.toString()).to.be.eq('3157894736842104');

          const redeemAmBefore = await mv.previewRedeem(ethers.utils.parseEther('0.5'));

          await mv.connect(signer1).redeem(ethers.utils.parseEther('0.5'), signer1.address, signer1.address);

          expect((await mv.totalSupply()).toString()).to.be.eq(ethers.utils.parseEther('0.5'))

          vy = await mv.getVaultYield();
          expect(vy.toString()).to.be.eq('0');

          const redeemAmAfter = await mv.previewRedeem(ethers.utils.parseEther('0.5'));
          expect(redeemAmBefore.toString()).to.be.eq(redeemAmAfter.toString(), 'redeem result changed after withdraw');

          await mv.connect(signer1).deposit(ethers.utils.parseEther('1'), signer1.address);
          const redeemAmAfterDep = await mv.previewRedeem(ethers.utils.parseEther('0.5'));
          expect(redeemAmAfterDep.toString()).to.be.eq(redeemAmAfter.toString(), 'redeem result changed after deposit');

          await token.setRatio("900000000000000000");

          // withdraw all
          await mv.connect(signer1).redeem(await mv.balanceOf(signer1.address), signer1.address, signer1.address);

          expect((await mv.balanceOf(signer1.address)).toString()).to.be.eq('0', 'signer still have mv balance')
          expect((await token.balanceOf(mv.address)).toString()).to.be.eq('0', 'dust')
        })

        it('its posibble to take 100% of yield', async () => {
          await mv.changeYieldHeritor(yieldHeritor.address);
          await mv.changeProvider(signer1.address);
          await mv.changeYieldMargin('10000');

          await token.mint(signer1.address, ethers.utils.parseEther('10000'));
          await token.connect(signer1).approve(mv.address, ethers.utils.parseEther('10000'));
          await mv.connect(signer1).deposit(ethers.utils.parseEther('10000'), signer1.address);

          const redeemAmBefore = (await mv.previewRedeem(ethers.utils.parseEther('10000'))).mul(ethers.utils.parseEther('1')).div('950000000000000000');
          expect(redeemAmBefore.toString()).to.be.eq('10526315789473684210526', 'wrong value of token before ratio change') // 10526.315789473684210526

          await token.setRatio("940000000000000000");

          const redeemAmAfter = (await mv.previewRedeem(ethers.utils.parseEther('10000'))).mul(ethers.utils.parseEther('1')).div('940000000000000000');
          expect(redeemAmAfter.toString()).to.be.eq('10526315789473684210527', 'wrong value of token after ratio change')

          let vy = await mv.getVaultYield();
          expect(vy.toString()).to.be.eq('105263157894736842104') // 105.263157894736842104
      })
    });
});