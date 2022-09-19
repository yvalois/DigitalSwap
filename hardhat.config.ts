require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");

const dotenv = require("dotenv");


const fs = require('fs');
const mnemonic = fs.readFileSync(".secret").toString().trim();

module.exports = {
  solidity: "0.8.4",
  networks: {
    hardhat: {
    },
    matic: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: {mnemonic: mnemonic}
    }
  },

    etherscan: {
      apiKey: 'MEVGDD5SR5P5ZBQHSKMQDYJI8GRHA7CFCH'

      }
  
};