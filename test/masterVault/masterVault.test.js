const { expect } = require('chai');
const { ethers } = require('hardhat');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

describe('===MasterVault===', function () {
    let deployer, signer1, signer2, signer3, signer4;

    let token,
        mv;

    beforeEach(async function () {

        [deployer, signer1, signer2, signer3, signer4, yieldHeritor] = await ethers.getSigners();

        // Contract factory
        this.Token = await ethers.getContractFactory("Token");
        this.MasterVault_V2 = await ethers.getContractFactory("MasterVault");

        // Contract deployment
        token = await upgrades.deployProxy(this.Token, ["Wrapped Staked Ether", "wstETH"], {initializer: "initialize"});
        await token.deployed();
        mv = await upgrades.deployProxy(this.MasterVault_V2, ["Master Vault Token", "ceMATIC", token.address], {initializer: "initialize"});
        await mv.deployed();

        await mv.changeDavosProvider(signer1.address);
    });

    describe('--- deposit', function () {

        it('reverts: assets is 0', async () => {
            await expect(mv.connect(signer1).deposit(0, signer1.address)).to.be.revertedWith("InvalidAssets()");
        })
        it('reverts: receiver is 0', async () => {
            await expect(mv.connect(signer1).deposit(ethers.utils.parseEther('1'), NULL_ADDRESS)).to.be.revertedWith("ZeroAddress()");
        })
        it('deposit', async () => {
            let previewDepositBefore = await mv.previewDeposit(ethers.utils.parseEther('1'));

            await token.mint(signer1.address, ethers.utils.parseEther('1'));
            await token.connect(signer1).approve(mv.address, ethers.utils.parseEther('1'));
            await mv.connect(signer1).deposit(ethers.utils.parseEther('1'), signer1.address);

            let sharesReceived = await mv.balanceOf(signer1.address);

            expect(previewDepositBefore.toString()).to.be.eq(sharesReceived.toString());
            expect(await mv.totalAssets()).to.be.eq(ethers.utils.parseEther('1'));
        })
    });

    describe('--- redeem', function () {

        it('reverts: shares is 0', async () => {
            await expect(mv.connect(signer1).redeem(0, signer1.address, signer1.address)).to.be.revertedWith("InvalidShares()");
        })
        it('reverts: receiver is 0', async () => {
            await expect(mv.connect(signer1).redeem(ethers.utils.parseEther('1'), NULL_ADDRESS, signer1.address)).to.be.revertedWith("ZeroAddress()");
        })
        it('redeem', async () => {
            let previewDepositBefore = await mv.previewDeposit(ethers.utils.parseEther('1'));

            await token.mint(signer1.address, ethers.utils.parseEther('1'));
            await token.connect(signer1).approve(mv.address, ethers.utils.parseEther('1'));
            await mv.connect(signer1).deposit(ethers.utils.parseEther('1'), signer1.address);

            let sharesReceived = await mv.balanceOf(signer1.address);

            expect(previewDepositBefore.toString()).to.be.eq(sharesReceived.toString());
            expect(await mv.totalAssets()).to.be.eq(ethers.utils.parseEther('1'));

            let previewRedeemBefore = await mv.previewRedeem(sharesReceived);

            await mv.connect(signer1).redeem(sharesReceived, signer1.address, signer1.address);

            expect(previewRedeemBefore).to.be.eq(await token.balanceOf(signer1.address));
            expect(await mv.totalAssets()).to.be.eq(0);
        })
    });

    describe('--- mint', function () {

        it('reverts: shares is 0', async () => {
            await expect(mv.connect(signer1).mint(0, signer1.address)).to.be.revertedWith("InvalidShares()");
        })
        it('reverts: receiver is 0', async () => {
            await expect(mv.connect(signer1).mint(ethers.utils.parseEther('1'), NULL_ADDRESS)).to.be.revertedWith("ZeroAddress()");
        })
        it('mint', async () => {
            let previewMintBefore = await mv.previewMint(ethers.utils.parseEther('1'));

            await token.mint(signer1.address, ethers.utils.parseEther('1'));
            await token.connect(signer1).approve(mv.address, ethers.utils.parseEther('1'));
            await mv.connect(signer1).mint(ethers.utils.parseEther('1'), signer1.address);

            let sharesReceived = await mv.balanceOf(signer1.address);

            expect(previewMintBefore.toString()).to.be.eq(await mv.totalAssets());
            expect(sharesReceived).to.be.eq(ethers.utils.parseEther('1'));
        })
    });

    describe('--- withdraw', function () {

        it('reverts: shares is 0', async () => {
            await expect(mv.connect(signer1).withdraw(0, signer1.address, signer1.address)).to.be.revertedWith("InvalidAssets()");
        })
        it('reverts: receiver is 0', async () => {
            await expect(mv.connect(signer1).withdraw(ethers.utils.parseEther('1'), NULL_ADDRESS, signer1.address)).to.be.revertedWith("ZeroAddress()");
        })
        it('withdraw', async () => {
            let previewMintBefore = await mv.previewMint(ethers.utils.parseEther('1'));

            await token.mint(signer1.address, ethers.utils.parseEther('1'));
            await token.connect(signer1).approve(mv.address, ethers.utils.parseEther('1'));
            await mv.connect(signer1).mint(ethers.utils.parseEther('1'), signer1.address);

            let sharesReceived = await mv.balanceOf(signer1.address);

            expect(previewMintBefore.toString()).to.be.eq(await mv.totalAssets());
            expect(sharesReceived).to.be.eq(ethers.utils.parseEther('1'));

            let previewWithdrawBefore = await mv.previewWithdraw(previewMintBefore);

            await mv.connect(signer1).withdraw(previewMintBefore, signer1.address, signer1.address);

            expect(previewWithdrawBefore).to.be.eq(ethers.utils.parseEther('1'));
            expect(await token.balanceOf(signer1.address)).to.be.eq(previewMintBefore);
        })
    });

    describe('--- changeDavosProvider', function () {

        it('reverts: new provider is 0', async () => {
            await expect(mv.changeDavosProvider(NULL_ADDRESS)).to.be.revertedWith("ZeroAddress()");
        })
        it('changeDavosProvider', async () => {
            expect(await mv.davosProvider()).to.be.eq(signer1.address);
            await mv.changeDavosProvider(signer2.address);
            expect(await mv.davosProvider()).to.be.eq(signer2.address);
        })
    });
});