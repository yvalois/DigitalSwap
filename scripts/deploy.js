const hre = require("hardhat");
const ethers = require("Ethers")

async function main() {
  const contractName = "PegDex";
  const contractVersion = "v1";
  const deployer="0x1Fe41D144f46AbcCf8Ee5f496B2cA4DF54F6b37E";
  const dlycop="0x1659fFb2d40DfB1671Ac226A0D9Dcc95A774521A";
  const usdt="0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
  const usdCopFeed="0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
  const wbtc="0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6";
  const Dtkn="0x86369AE0d99315AD1C6aa403D688a063F33dE8EF";
  const uniswapV2Router="0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

  const PegDex = await hre.ethers.getContractFactory("PegDex");
  const pegDex = await PegDex.deploy(dlycop, usdt, usdCopFeed, wbtc,Dtkn, uniswapV2Router, 30, 3, ethers.utils.parseEther("500000"));
  


  await pegDex.deployed();

  console.log("MyContract PegDex deployed to:", pegDex.address)

const Token = await hre.ethers.getContractFactory("Token");
  const token = await Token.deploy(

  );
 
  await token.deployed();

  console.log("MyContract Token deployed to:", token.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
