require("dotenv").config();
// require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require('@nomiclabs/hardhat-truffle5');
require('@nomiclabs/hardhat-web3');
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("solidity-coverage");
require('hardhat-spdx-license-identifier');
require('hardhat-abi-exporter');
require('hardhat-storage-layout');
require('@openzeppelin/hardhat-upgrades');
require("@nomicfoundation/hardhat-verify");

const fs = require("fs");

module.exports = {
    solidity: {
        compilers: [
            {
                version: '0.8.29',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 100
                    }
                }
            },
            {
                version: '0.8.15',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 100
                    }
                }
            },
            {
                version: '0.8.10',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 100
                    }
                }
            },
            {
                version: '0.7.6',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 100
                    }
                }
            },{
                version: '0.8.2',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 100
                    }
                }
            }
        ]
    },

    networks: {
        hardhat: 
        {
            accounts: {
                accountsBalance: "100000000000000000000000000",
              },
        },
        ethereum: {
            url: process.env.ETHEREUM_URL,
            chainId: 1,
            accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
            gasPrice: parseInt(process.env.GAS_PRICE_ETH) || 'auto'
        },
        ethereumTestnet: {
            url: process.env.SEPOLIA_URL,
            chainId: 17000,
            accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
            gasPrice: parseInt(process.env.GAS_PRICE_ETH) || 'auto'
        }
    },

    etherscan: {
        apiKey: process.env.SCAN_API_KEY,
        customChains: [
              {
                network: "bitLayerTestnet",
                chainId: 200810,
                urls: {
                  apiURL: "https://api-testnet.btrscan.com/scan/api",
                  browserURL: "https://testnet.btrscan.com/"
                }
              },
              {
                network: "bitLayer",
                chainId: 200901,
                urls: {
                  apiURL: "https://api.btrscan.com/scan/api",
                  browserURL: "https://www.btrscan.com/"
                }
              }
          ]
    },

    sourcify: {
        // Disabled by default
        // Doesn't need an API key
        enabled: true
    },

    mocha: {
        grep: '^(?!.*; using Ganache).*'
    },

    contractSizer: {
        alphaSort: true,
        runOnCompile: true,
        disambiguatePaths: false,
    },

    gasReporter: {
        enabled: process.env.REPORT_GAS ? true : false,
        currency: 'USD',
    },
};