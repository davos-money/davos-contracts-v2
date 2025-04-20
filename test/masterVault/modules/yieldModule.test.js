const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

describe('===YieldModule===', function () {
    let deployer, signer1, signer2, signer3, signer4, yieldHeritor;

    let token,
        mv,
        yieldModule,
        licensor,
        priceController;

    beforeEach(async function () {

        [deployer, signer1, signer2, signer3, signer4, yieldHeritor] = await ethers.getSigners();

        // Contract factory
        this.Token = await ethers.getContractFactory("Token");
        this.MasterVault_V2 = await ethers.getContractFactory("MasterVault");
        this.Licensor = await ethers.getContractFactory("Licensor");
        this.YieldModule = await ethers.getContractFactory("YieldModule");
        this.PriceController = await ethers.getContractFactory("PriceController");

        // Contract deployment
        token = await upgrades.deployProxy(this.Token, ["Wrapped Staked Ether", "wstETH"], {initializer: "initialize"});
        await token.deployed();
        await token.setRatio("950000000000000000");

        mv = await upgrades.deployProxy(this.MasterVault_V2, ["Master Vault Token", "ceMATIC", token.address], {initializer: "initialize"});
        await mv.deployed();

        priceController = await upgrades.deployProxy(this.PriceController, [], {initializer: "initialize"});
        await priceController.deployed();
        await priceController.setToken(token.address, 'getStETHByWstETH(uint256)', 'getWstETHByStETH(uint256)', '', false);

        licensor = await upgrades.deployProxy(this.Licensor, [deployer.address, 0, 0], {initializer: "initialize"});

        yieldModule = await upgrades.deployProxy(this.YieldModule, [mv.address, licensor.address, 1000], {initializer: "initialize"});
        await yieldModule.changePriceController(priceController.address);

        // Contract init
        await mv.addModule(yieldModule.address, "0x");
        await mv.changeDavosProvider(signer1.address);
    });

    describe('--- initialize', function () {

      it('reverts: MoreThanMax', async () => {

        await expect(upgrades.deployProxy(await ethers.getContractFactory("YieldModule"), [mv.address, licensor.address, 10001], {initializer: "initialize"})).to.be.revertedWith("MoreThanMax()");
      })
      it('initializes', async () => {

        yieldModule = await upgrades.deployProxy(await ethers.getContractFactory("YieldModule"), [mv.address, licensor.address, 9999], {initializer: "initialize"});
        expect(await yieldModule.yieldMargin()).to.be.eq(9999);
        expect(await yieldModule.masterVault()).to.be.eq(mv.address);
        expect(await yieldModule.licensor()).to.be.eq(licensor.address);
      })
    });

    describe('--- General', function () {

        it('proves pre-claimYield previews = post-claimYield previews', async () => {

          // We need special focus on previewRedeem
          await token.mint(signer1.address, ethers.utils.parseEther('10000'));
          await token.connect(signer1).approve(mv.address, ethers.utils.parseEther('10000'));
          await mv.connect(signer1).deposit(ethers.utils.parseEther('10000'), signer1.address);

          await token.setRatio("940000000000000000");

          const redeemAmBefore = await mv.previewRedeem(ethers.utils.parseEther('10000'));
          const depositAmBefore = await mv.previewDeposit(redeemAmBefore);

          const mintAmBefore = await mv.previewMint(depositAmBefore);
          const withdrawAmBefore = await mv.previewWithdraw(mintAmBefore);

          let vy = await yieldModule.getVaultYield();
          expect(vy.toString()).to.be.eq('10526315789473684209') // 10.526315789473684209

          await yieldModule.claimYield();

          const redeemAmAfter = await mv.previewRedeem(ethers.utils.parseEther('10000'))
          const depositAmAfter = await mv.previewDeposit(redeemAmAfter);

          const mintAmAfter = await mv.previewMint(depositAmAfter);
          const withdrawAmAfter = await mv.previewWithdraw(mintAmAfter);

          expect(redeemAmBefore.toString()).to.be.eq(redeemAmAfter.toString(), 'inconsistent redeem preview');
          expect(depositAmBefore.toString()).to.be.closeTo(BigNumber.from(depositAmAfter), 1, 'inconsistent deposit preview');
          expect(mintAmBefore.toString()).to.be.closeTo(BigNumber.from(mintAmAfter), 1, 'inconsistent mint preview');
          expect(withdrawAmBefore.toString()).to.be.closeTo(BigNumber.from(withdrawAmAfter), 1, 'inconsistent withdraw preview');

          expect(redeemAmAfter.toString()).to.be.eq(BigNumber.from(ethers.utils.parseEther('10000')).sub(vy), 'redeem amount is wrong');
          expect(depositAmAfter.toString()).to.be.closeTo(BigNumber.from(ethers.utils.parseEther('10000')), 1, 'deposit amount is wrong');
          expect(mintAmAfter.toString()).to.be.closeTo(BigNumber.from(redeemAmBefore), 1, 'mint amount is wrong');
          expect(withdrawAmAfter.toString()).to.be.closeTo(BigNumber.from(depositAmAfter), 1, 'withdraw amount is wrong');
        })

        it('shows claimYield during deposit/redeem/mint/withdraw module hooks', async () => {

          await token.mint(signer1.address, ethers.utils.parseEther('1000'));
          await token.connect(signer1).approve(mv.address, ethers.utils.parseEther('1000'));
          await mv.connect(signer1).deposit(ethers.utils.parseEther('1'), signer1.address); // deposit

          let vy = await yieldModule.getVaultYield();
          expect(vy.toString()).to.be.eq('0', 'initial yield not zero');

          await token.setRatio("920000000000000000");

          vy = await yieldModule.getVaultYield();
          expect(vy.toString()).to.be.eq('3157894736842104');

          let redeemAmBefore = await mv.previewRedeem(ethers.utils.parseEther('0.5'));

          await mv.connect(signer1).redeem(ethers.utils.parseEther('0.5'), signer1.address, signer1.address); // redeem

          expect((await mv.totalSupply()).toString()).to.be.eq(ethers.utils.parseEther('0.5'))

          vy = await yieldModule.getVaultYield();
          expect(vy.toString()).to.be.eq('0');

          let redeemAmAfter = await mv.previewRedeem(ethers.utils.parseEther('0.5'));
          expect(redeemAmBefore.toString()).to.be.eq(redeemAmAfter.toString(), 'redeem result changed after withdraw');

          let mintAmount = await mv.previewDeposit(ethers.utils.parseEther('1'));
          await mv.connect(signer1).mint(mintAmount, signer1.address); // mint
          let redeemAmAfterDep = await mv.previewRedeem(ethers.utils.parseEther('0.5'));
          expect(redeemAmAfterDep.toString()).to.be.eq(redeemAmAfter.toString(), 'redeem result changed after deposit');

          await token.setRatio("900000000000000000");

          let withdrawAmount = await mv.previewRedeem(await mv.balanceOf(signer1.address));
          await mv.connect(signer1).withdraw(withdrawAmount, signer1.address, signer1.address); // withdraw

          expect((await mv.balanceOf(signer1.address)).toString()).to.be.eq('0', 'signer still have mv balance')
          expect((await token.balanceOf(mv.address)).toString()).to.be.eq('0', 'dust')
        })

        it('gets 100% of the yield from vault', async () => {

          await yieldModule.changeYieldMargin('10000');

          await token.mint(signer1.address, ethers.utils.parseEther('10000'));
          await token.connect(signer1).approve(mv.address, ethers.utils.parseEther('10000'));
          await mv.connect(signer1).deposit(ethers.utils.parseEther('10000'), signer1.address);

          const redeemAmBefore = (await mv.previewRedeem(ethers.utils.parseEther('10000'))).mul(ethers.utils.parseEther('1')).div('950000000000000000');
          const totalAssetsExpandedBefore = await yieldModule.expandUnderlyings();
          const totalAssetsBefore = await mv.totalAssets();
          expect(redeemAmBefore.toString()).to.be.eq('10526315789473684210526', 'wrong value of token before ratio change') // 10526.315789473684210526

          await token.setRatio("940000000000000000");

          const redeemAmAfter = (await mv.previewRedeem(ethers.utils.parseEther('10000'))).mul(ethers.utils.parseEther('1')).div('940000000000000000');
          const totalAssetsExpandedAfter = await yieldModule.expandUnderlyings();
          const totalAssetsAfter = await mv.totalAssets();
          expect(redeemAmAfter.toString()).to.be.eq('10526315789473684210527', 'wrong value of token after ratio change')

          let vy = await yieldModule.getVaultYield();
          expect(vy.toString()).to.be.eq('105263157894736842104') // 105.263157894736842104
          expect(totalAssetsExpandedBefore).to.be.eq(BigNumber.from(redeemAmBefore));
          expect(vy).to.be.eq(BigNumber.from(await priceController.convertToShares(token.address, BigNumber.from(totalAssetsExpandedAfter).sub(totalAssetsExpandedBefore))));
          expect(totalAssetsAfter).to.be.below(BigNumber.from(totalAssetsBefore));
          expect(totalAssetsAfter).to.be.equal(BigNumber.from(totalAssetsBefore).sub(vy));
      })
    });
});