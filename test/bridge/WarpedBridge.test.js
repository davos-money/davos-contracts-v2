// Import constants
const { ethers, waffle } = require("hardhat");
const hre = require("hardhat");
const { assert, expect } = require("chai");
const web3x = require("web3");
const {
    encodeTransactionReceipt,
    encodeProof,
} = require("./utils/bridge_utils");
const { signMessageUsingPrivateKey } = require("./utils/evmutils");

// Constants
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const CHAIN1 = "31337";
const CHAIN2 = "31338";
const CHAIN1_TOKEN_NAME = "Ethereum";
const CHAIN1_TOKEN_SYMBOL = "ETH";
const CHAIN2_TOKEN_NAME = "Polygon";
const CHAIN2_TOKEN_SYMBOL = "MATIC";
const amount = ethers.utils.parseEther('10');

// Addresses
let deployer, eoa1, eoa2, consensus, treasury;

// Protocol Contracts
let router, bridge1, bridge2, tokenFactory;

// Participant Contracts
let warptoken1, warptoken2;

// Offchain data
let encodedProof, rawReceipt, proofSignature, proofHash, receiptHash, receipt;

describe("===Bridge===", function () {
    describe("Bridge WarpToken to WarpToken", async () => {
        before(async () => {

            // Get Addresses
            [deployer, eoa1, eoa2, consensus, treasury] = await hre.ethers.getSigners();

            // Contract Factory
            const WarpToken = await ethers.getContractFactory("WarpToken");
            const Bridge = await ethers.getContractFactory("Bridge");
    
            // Contract Deployment
            warptoken1 = await WarpToken.connect(deployer).deploy(); await warptoken1.deployed();
            warptoken2 = await WarpToken.connect(deployer).deploy(); await warptoken2.deployed();
            bridge1 = await upgrades.deployProxy(Bridge, [consensus.address, CHAIN1_TOKEN_SYMBOL, CHAIN1_TOKEN_NAME], {initializer: "initialize"}); await bridge1.deployed();
            bridge2 = await upgrades.deployProxy(Bridge, [consensus.address, CHAIN2_TOKEN_SYMBOL, CHAIN2_TOKEN_NAME], {initializer: "initialize"}); await bridge2.deployed();

            // Contract Initialization
            await warptoken1.connect(deployer).initialize();
            await warptoken2.connect(deployer).initialize();
            
            await warptoken1.connect(deployer).mint(eoa1.address, ethers.utils.parseEther('100'));

            // Bridges must know about each other before warp
            await bridge1.addBridge(bridge2.address, CHAIN1);
            await bridge2.addBridge(bridge1.address, CHAIN1);

            // Add warp link between two warp tokens on different chains [Using same chain for test]
            await bridge1.addWarpDestination(warptoken1.address, CHAIN1, warptoken2.address);
            await bridge2.addWarpDestination(warptoken2.address, CHAIN1, warptoken1.address);
        });
        it("Deposit WarpToken1", async () => {

            this.timeout(1500000000);

            // A bridge must have a right to mint for warp token
            await warptoken1.rely(bridge1.address);
            await warptoken2.rely(bridge2.address);

            // Bridge can only warp tokens with allowance from 'eoa1'
            await warptoken1.connect(eoa1).approve(bridge1.address, ethers.utils.parseEther('10'));

            // Deposit WarpToken1
            expect((await warptoken1.balanceOf(eoa1.address)).toString()).to.be.equal(ethers.utils.parseEther('100').toString());
            expect((await warptoken1.totalSupply()).toString()).to.be.equal(ethers.utils.parseEther('100').toString());

            let tx1 = await bridge1.connect(eoa1).depositToken(warptoken1.address, CHAIN1, eoa2.address, amount);
            receipt = await tx1.wait();

            expect((await warptoken1.balanceOf(eoa1.address)).toString()).to.be.equal(ethers.utils.parseEther('90').toString());
            expect((await warptoken1.totalSupply()).toString()).to.be.equal(ethers.utils.parseEther('90').toString());

            assert.equal(receipt.events[1].event, "DepositWarped");
            assert.equal(receipt.events[1].args["fromAddress"].toString(), eoa1.address, "Wrong toChain");
            assert.equal(receipt.events[1].args["toAddress"].toString(), eoa2.address, "Wrong toAddress");
            assert.equal(receipt.events[1].args["fromToken"].toString(), warptoken1.address, "Wrong fromToken");
            assert.equal(receipt.events[1].args["toToken"].toString(), warptoken2.address, "Wrong toToken");
            assert.equal(receipt.events[1].args["totalAmount"].toString(), amount, "Wrong totalAmount");
            // assert.equal(receipt.events[1].args["nonce"].toString(), 1, "Wrong _contractNonce");
            assert.equal(receipt.events[1].args["metadata"].symbol.toString(), ethers.utils.formatBytes32String("WTKN"), "Wrong symbol");
            assert.equal(receipt.events[1].args["metadata"].name.toString(), ethers.utils.formatBytes32String("WarpToken"), "Wrong name");
            assert.equal(receipt.events[1].args["metadata"].originChain, 0, "Wrong originChain");
            assert.equal(receipt.events[1].args["metadata"].originAddress, NULL_ADDRESS, "Wrong originToken");
        });
        it("Withdraw WarpToken2", async function () {

            this.timeout(1500000000);

            // Process proofs
            [encodedProof, rawReceipt, proofSignature, proofHash] = generateWithdrawalData(consensus, receipt);

            // Withdraw WarpToken2
            expect((await warptoken2.balanceOf(eoa2.address)).toString()).to.be.equal(ethers.utils.parseEther('0').toString());
            expect((await warptoken2.totalSupply()).toString()).to.be.equal(ethers.utils.parseEther('0').toString());

            let tx2 = await bridge2.connect(eoa2).withdraw(encodedProof, rawReceipt, proofSignature);

            // let tx2 = await bridge2.connect(eoa2).withdraw(encodedProof, rawReceipt, proofSignature, proofHash);
            receipt = await tx2.wait();

            expect((await warptoken2.totalSupply()).toString()).to.be.equal(ethers.utils.parseEther('10').toString());
            expect((await warptoken2.balanceOf(eoa2.address)).toString()).to.be.equal(ethers.utils.parseEther('10').toString());

            assert.equal(receipt.events[1].event, "WithdrawMinted");
            assert.equal(receipt.events[1].args["receiptHash"].toString(), receiptHash, "Wrong receiptHash");
            assert.equal(receipt.events[1].args["fromAddress"].toString(), eoa1.address, "Wrong fromAddress");
            assert.equal(receipt.events[1].args["toAddress"].toString(), eoa2.address, "Wrong toAddress");
            assert.equal(receipt.events[1].args["fromToken"].toString(), warptoken1.address, "Wrong fromToken");
            assert.equal(receipt.events[1].args["toToken"].toString(), warptoken2.address, "Wrong toToken");
            assert.equal(receipt.events[1].args["totalAmount"].toString(), amount, "Wrong totalAmount");
        });
        it("Deposit WarpToken2", async () => {

            this.timeout(1500000000);

            // Bridge can only warp tokens with allowance from 'eoa1'
            await warptoken2.connect(eoa2).approve(bridge2.address, ethers.utils.parseEther('10'));

            // Deposit WarpToken1
            expect((await warptoken2.balanceOf(eoa2.address)).toString()).to.be.equal(ethers.utils.parseEther('10').toString());
            expect((await warptoken2.totalSupply()).toString()).to.be.equal(ethers.utils.parseEther('10').toString());
            
            let tx1 = await bridge2.connect(eoa2).depositToken(warptoken2.address, CHAIN1, eoa1.address, amount);
            receipt = await tx1.wait();

            expect((await warptoken2.balanceOf(eoa2.address)).toString()).to.be.equal(ethers.utils.parseEther('0').toString());
            expect((await warptoken2.totalSupply()).toString()).to.be.equal(ethers.utils.parseEther('0').toString());

            assert.equal(receipt.events[1].event, "DepositWarped");
            assert.equal(receipt.events[1].args["fromAddress"].toString(), eoa2.address, "Wrong toChain");
            assert.equal(receipt.events[1].args["toAddress"].toString(), eoa1.address, "Wrong toAddress");
            assert.equal(receipt.events[1].args["fromToken"].toString(), warptoken2.address, "Wrong fromToken");
            assert.equal(receipt.events[1].args["toToken"].toString(), warptoken1.address, "Wrong toToken");
            assert.equal(receipt.events[1].args["totalAmount"].toString(), amount, "Wrong totalAmount");
            // assert.equal(receipt.events[1].args["nonce"].toString(), 1, "Wrong _contractNonce");
            assert.equal(receipt.events[1].args["metadata"].symbol.toString(), ethers.utils.formatBytes32String("WTKN"), "Wrong symbol");
            assert.equal(receipt.events[1].args["metadata"].name.toString(), ethers.utils.formatBytes32String("WarpToken"), "Wrong name");
            assert.equal(receipt.events[1].args["metadata"].originChain, 0, "Wrong originChain");
            assert.equal(receipt.events[1].args["metadata"].originAddress, NULL_ADDRESS, "Wrong originToken");
        });
        it("Withdraw WarpToken1", async function () {

            this.timeout(1500000000);

            // Process proofs
            [encodedProof, rawReceipt, proofSignature, proofHash] = generateWithdrawalData(consensus, receipt);

            // Withdraw WarpToken2
            expect((await warptoken1.balanceOf(eoa1.address)).toString()).to.be.equal(ethers.utils.parseEther('90').toString());
            expect((await warptoken1.totalSupply()).toString()).to.be.equal(ethers.utils.parseEther('90').toString());

            let tx2 = await bridge1.connect(eoa1).withdraw(encodedProof, rawReceipt, proofSignature);
            receipt = await tx2.wait();

            expect((await warptoken1.totalSupply()).toString()).to.be.equal(ethers.utils.parseEther('100').toString());
            expect((await warptoken1.balanceOf(eoa1.address)).toString()).to.be.equal(ethers.utils.parseEther('100').toString());

            assert.equal(receipt.events[1].event, "WithdrawMinted");
            assert.equal(receipt.events[1].args["receiptHash"].toString(), receiptHash, "Wrong receiptHash");
            assert.equal(receipt.events[1].args["fromAddress"].toString(), eoa2.address, "Wrong fromAddress");
            assert.equal(receipt.events[1].args["toAddress"].toString(), eoa1.address, "Wrong toAddress");
            assert.equal(receipt.events[1].args["fromToken"].toString(), warptoken2.address, "Wrong fromToken");
            assert.equal(receipt.events[1].args["toToken"].toString(), warptoken1.address, "Wrong toToken");
            assert.equal(receipt.events[1].args["totalAmount"].toString(), amount, "Wrong totalAmount");
        });
        it("reverts: Non-consensus signing", async () => {

            this.timeout(1500000000);

            // --- Deposit ---
            // Bridge can only warp tokens with allowance from 'eoa1'
            await warptoken1.connect(eoa1).approve(bridge1.address, ethers.utils.parseEther('10'));

            // Deposit WarpToken1
            expect((await warptoken1.balanceOf(eoa1.address)).toString()).to.be.equal(ethers.utils.parseEther('100').toString());
            expect((await warptoken1.totalSupply()).toString()).to.be.equal(ethers.utils.parseEther('100').toString());

            let tx1 = await bridge1.connect(eoa1).depositToken(warptoken1.address, CHAIN1, eoa2.address, amount);
            receipt = await tx1.wait();

            expect((await warptoken1.balanceOf(eoa1.address)).toString()).to.be.equal(ethers.utils.parseEther('90').toString());
            expect((await warptoken1.totalSupply()).toString()).to.be.equal(ethers.utils.parseEther('90').toString());

            assert.equal(receipt.events[1].event, "DepositWarped");
            assert.equal(receipt.events[1].args["fromAddress"].toString(), eoa1.address, "Wrong toChain");
            assert.equal(receipt.events[1].args["toAddress"].toString(), eoa2.address, "Wrong toAddress");
            assert.equal(receipt.events[1].args["fromToken"].toString(), warptoken1.address, "Wrong fromToken");
            assert.equal(receipt.events[1].args["toToken"].toString(), warptoken2.address, "Wrong toToken");
            assert.equal(receipt.events[1].args["totalAmount"].toString(), amount, "Wrong totalAmount");
            // assert.equal(receipt.events[1].args["nonce"].toString(), 1, "Wrong _contractNonce");
            assert.equal(receipt.events[1].args["metadata"].symbol.toString(), ethers.utils.formatBytes32String("WTKN"), "Wrong symbol");
            assert.equal(receipt.events[1].args["metadata"].name.toString(), ethers.utils.formatBytes32String("WarpToken"), "Wrong name");
            assert.equal(receipt.events[1].args["metadata"].originChain, 0, "Wrong originChain");
            assert.equal(receipt.events[1].args["metadata"].originAddress, NULL_ADDRESS, "Wrong originToken");

            // --- Withdraw ---
            // Process proofs but signer is non-consensus
            [encodedProof, rawReceipt, proofSignature, proofHash] = generateWithdrawalData(treasury, receipt);

            // Withdraw WarpToken2
            expect((await warptoken2.balanceOf(eoa2.address)).toString()).to.be.equal(ethers.utils.parseEther('0').toString());
            expect((await warptoken2.totalSupply()).toString()).to.be.equal(ethers.utils.parseEther('0').toString());

            await expect(bridge2.connect(eoa2).withdraw(encodedProof, rawReceipt, proofSignature)).to.be.revertedWith("Bridge/bad-signature");
        });
    });
});

function generateWithdrawalData(signer, receipt) {
    [rawReceipt, receiptHash] = encodeTransactionReceipt(receipt);

    [encodedProof, proofHash] = encodeProof(
    CHAIN1,
    1,
    receipt.transactionHash,
    receipt.blockNumber,
    receipt.blockHash,
    receipt.transactionIndex,
    receiptHash,
    web3x.utils.padLeft(web3x.utils.toHex(amount), 64)
    );

    const accounts = config.networks.hardhat.accounts;
    for (i = 0; ; i++) {
        const wallet1 = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${i}`);
        if (wallet1.address == signer.address) {
            const privateKey = wallet1.privateKey.substring(2);
            proofSignature = signMessageUsingPrivateKey(privateKey, proofHash);
            break;
        }
    }

    return [encodedProof, rawReceipt, proofSignature, proofHash];
}