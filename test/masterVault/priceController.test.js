const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { joinSignature } = require('ethers/lib/utils');
const { ethers, network } = require('hardhat');
const Web3 = require('web3');
const {expectEvent} = require("@openzeppelin/test-helpers");

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const DATA = "0x02";

describe('===PriceController===', function () {
  let deployer, signer1, signer2, signer3, signer4;

  let token,
    priceController,
    res,
    rateProvider;

  beforeEach(async function () {

    [deployer, signer1, signer2, signer3, signer4] = await ethers.getSigners();

    // Contract factory
    this.Token = await ethers.getContractFactory("Token");
    this.PriceController = await ethers.getContractFactory("PriceController");
    this.RateProviderMock = await ethers.getContractFactory("RateProviderMock");

    // Contract deployment
    token = await upgrades.deployProxy(this.Token, ["Wrapped Staked Ether", "wstETH"], {initializer: "initialize"});
    await token.deployed();
    await token.setRatio("500000000000000000");

    rateProvider = await this.RateProviderMock.deploy(ethers.utils.parseEther('1'));
    await rateProvider.deployed();

    priceController = await upgrades.deployProxy(this.PriceController, [], {initializer: "initialize"});
    await priceController.deployed();
  });

  describe('Conversion', function () {
    it('wstETH', async function () {
      res = await priceController.setToken(token.address, 'getStETHByWstETH(uint256)', 'getWstETHByStETH(uint256)', '', false);
      expect(res).to.emit(priceController, 'TokenSet').withArgs(token.address, '1');

      res = await priceController.convertToShares(token.address, ethers.utils.parseEther('1'));
      expect(res.toString()).to.be.eq('500000000000000000'); // 1 * 0.5

      res = await priceController.convertToAssets(token.address, ethers.utils.parseEther('1'));
      expect(res.toString()).to.be.eq('2000000000000000000'); // 1 / 0.5
    });

    it('rETH', async function () {
      res = await priceController.setToken(token.address, 'getRethValue(uint256)', 'getEthValue(uint256)', "", false);
      expect(res).to.emit(priceController, 'TokenSet').withArgs(token.address, '1');

      res = await priceController.convertToShares(token.address, ethers.utils.parseEther('2'));
      expect(res.toString()).to.be.eq('1000000000000000000')

      res = await priceController.convertToAssets(token.address, ethers.utils.parseEther('2'));
      expect(res.toString()).to.be.eq('4000000000000000000')
    });

    it('sfrxETH', async function () {
      res = await priceController.setToken(token.address, 'convertToAssets(uint256)', 'convertToShares(uint256)', "", true);
      expect(res).to.emit(priceController, 'TokenSet').withArgs(token.address, '1');

      res = await priceController.convertToShares(token.address, ethers.utils.parseEther('3'));
      expect(res.toString()).to.be.eq('1500000000000000000')

      res = await priceController.convertToAssets(token.address, ethers.utils.parseEther('3'));
      expect(res.toString()).to.be.eq('6000000000000000000')
    })

    it('ankrETH', async function () {
      res = await priceController.setToken(token.address, 'sharesToBonds(uint256)', 'bondsToShares(uint256)', "", false);
      expect(res).to.emit(priceController, 'TokenSet').withArgs(token.address, '1');

      res = await priceController.convertToShares(token.address, ethers.utils.parseEther('4'));
      expect(res.toString()).to.be.eq('2000000000000000000')

      res = await priceController.convertToAssets(token.address, ethers.utils.parseEther('4'));
      expect(res.toString()).to.be.eq('8000000000000000000')
    });

    it('swETH', async function () {
      await priceController.setToken(token.address, "", "", 'ethToSwETHRate()', true);
      await token.setRatio(ethers.utils.parseEther('2'));

      res = await priceController.convertToShares(token.address, ethers.utils.parseEther('1'));
      expect(res.toString()).to.be.eq('500000000000000000'); // 1 / 2

      res = await priceController.convertToAssets(token.address, ethers.utils.parseEther('1'));
      expect(res.toString()).to.be.eq('2000000000000000000'); // 1 * 2
    });

    it('stMATIC', async function () {
      await priceController.setToken(token.address, "convertStMaticToMatic(uint256)", "convertMaticToStMatic(uint256)", "", false);

      res = await priceController.convertToShares(token.address, ethers.utils.parseEther('1'));
      expect(res.toString()).to.be.eq('500000000000000000'); // 1 * 0.5

      res = await priceController.convertToAssets(token.address, ethers.utils.parseEther('1'));
      expect(res.toString()).to.be.eq('2000000000000000000'); // 1 / 0.5
    });

    it('stMATIC with external provider', async function () {
      await priceController.setToken(token.address, '', '', 'getRate()', true);
      await priceController.setProviderForToken(token.address, rateProvider.address);

      res = await priceController.convertToShares(token.address, ethers.utils.parseEther('1'));
      expect(res.toString()).to.be.eq('1000000000000000000'); // 1 * 1

      await rateProvider.update(ethers.utils.parseEther('2'));

      res = await priceController.convertToShares(token.address, ethers.utils.parseEther('1'));
      expect(res.toString()).to.be.eq('500000000000000000'); // 1 / 2
      res = await priceController.convertToAssets(token.address, ethers.utils.parseEther('1'));
      expect(res.toString()).to.be.eq('2000000000000000000'); // 1 * 2
    });

    it('MATICx', async function () {
      res = await priceController.setToken(token.address, "convertMaticXToMatic(uint256)", "convertMaticToMaticX(uint256)", "", false);
      expect(res).to.emit(priceController, 'TokenSet').withArgs(token.address, '3');

      res = await priceController.convertToShares(token.address, ethers.utils.parseEther('1'));
      expect(res.toString()).to.be.eq('500000000000000000'); // 1 * 0.5

      res = await priceController.convertToAssets(token.address, ethers.utils.parseEther('1'));
      expect(res.toString()).to.be.eq('2000000000000000000'); // 1 / 0.5
    });
  });
});