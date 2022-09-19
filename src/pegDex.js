import pegDexAbi from "./tokens/pegDex.json";
import tokenList from "./tokens/tokenList.json";
import tokenAbi from "./tokens/tokenAbi.json";
import uniswapRouterAbi from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import { ethers } from "ethers";
import { Token, TokenAmount, Fetcher, Fraction, Percent } from "@uniswap/sdk";

export const pegDexContract = new ethers.Contract(
  "0xC6AF9710E6AadEDe2A87d90c89B43035445Cd8Dd",
  pegDexAbi.abi
);

export const usdPriceDecimals = 8;
export const copTokenDecimals = 18;
export const usdTokenDecimals = 6;
export const chainId = 137;

const routerContractAddress = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

let provider;

export function setProvider(_provider) {
  provider = _provider;
}

const copContract = tokenList.find(
  (token) => token.symbol.toUpperCase() == "DLYCOP"
).address;
const wETHContract = tokenList.find(
  (token) => token.symbol.toUpperCase() === "MATIC"
).address;
const wBTContract = tokenList.find(
  (token) => token.symbol.toUpperCase() === "WBTC"
).address;
const usdContract = tokenList.find(
  (token) => token.symbol.toUpperCase() === "USDT"
).address;
const tknContract = tokenList.find(
  (token) => token.symbol.toUpperCase() === "DTKN"
).address;

const routerInstance = new ethers.Contract(
  routerContractAddress,
  uniswapRouterAbi.abi
);

function usdToCop(usd, usdPrice) {
  return usd
    .mul(ethers.BigNumber.from(10).pow(usdPriceDecimals))
    .div(usdPrice)
    .mul(ethers.BigNumber.from(10).pow(copTokenDecimals - usdTokenDecimals));
}

function copToUsd(cop, usdPrice) {
  return cop
    .mul(usdPrice)
    .div(
      ethers.BigNumber.from(10).pow(
        usdPriceDecimals + copTokenDecimals - usdTokenDecimals
      )
    );
}

function getMinAmountOut(amountOut, slippageTolerancePercentage) {
  return amountOut.rawValue.mul(100 - slippageTolerancePercentage).div(100);
}

async function getDeadline(minutesToExpiration) {
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);
  return block.timestamp + 60 * minutesToExpiration;
}

async function getAmountOutForInput(tokenIn, amountIn, tokenOut) {
  const [, amountOut] = await routerInstance
    .connect(provider)
    .getAmountsOut(amountIn, [tokenIn, tokenOut]);
  return amountOut;
}

function getDecimalsFromTokenContract(tokenAddress) {
  const tokenContractInstance = new ethers.Contract(
    tokenAddress,
    tokenAbi.abi,
    provider
  );
  return tokenContractInstance.decimals();
}

export function getTokenBalanceForAddress(token, accountAddress) {
  const tokenContractInstance = new ethers.Contract(
    token,
    tokenAbi.abi,
    provider
  );
  return tokenContractInstance.balanceOf(accountAddress);
}

function getTokensAllowanceForPegDexFromUser(userAddress, tokenAddress) {
  const tokenContractInstance = new ethers.Contract(
    tokenAddress,
    tokenAbi.abi,
    provider
  );
  return tokenContractInstance.allowance(userAddress, pegDexAbi.address);
}

function priceWithTRM(totalCopAmount, currentFee, usdTRM) {
  const amountWithFee = totalCopAmount.mul(ethers.BigNumber.from(1000).sub(currentFee))
    .div(1000);
  return copToUsd(amountWithFee, usdTRM);
}

export async function calculatePriceImpact(totalCOPAmount) {
  const pegDexWithProvider = pegDexContract.connect(provider);
  const [currentUsdOut, currentFee, usdTRM] = await Promise.all([
    pegDexWithProvider.getAmountOutInUSD(totalCOPAmount),
    pegDexWithProvider.fee(),
    pegDexWithProvider.getLatestPrice(),
  ]);
  const usdPriceWithTRM = priceWithTRM(totalCOPAmount, currentFee, usdTRM);
  const fraction = new Fraction(currentUsdOut.mul(100), usdPriceWithTRM);
  const result = new Fraction(100, 1).subtract(fraction);
  return result.toFixed(2);
}

export async function isCOPToken(token) {
  return token === copContract;
}

async function fromRawAmountToPresentationAndRawValue(tokenAddress, rawAmount) {
  const tokenDecimals = await getDecimalsFromTokenContract(tokenAddress);
  const presentationValue = new TokenAmount(
    new Token(
      chainId,
      tokenAddress,
      Number.parseInt(tokenDecimals.toString()),
      "",
      ""
    ),
    rawAmount
  ).toFixed();
  return {
    rawValue: rawAmount,
    presentationValue,
  };
}

export async function getAmountOut(fromToken, fromTokenInput, toToken) {
  //Acaaa
  const contractWithProvider = pegDexContract.connect(provider);
  if (fromToken == copContract) {
    return await fromRawAmountToPresentationAndRawValue(
      toToken,
      await contractWithProvider.swapCOPForTokensPreview(toToken, fromTokenInput)
    );
    //return copToMatic(fromTokenInput);
  } else if (fromToken != wETHContract) {
    return await fromRawAmountToPresentationAndRawValue(
      toToken,
      await contractWithProvider.swapTokensForCOPPreview(fromToken, fromTokenInput)
    );
  }
  return await fromRawAmountToPresentationAndRawValue(
    toToken,
    await contractWithProvider.swapMaticForCOPPreview(fromTokenInput)
  );
}

export async function checkIfuserHasApprovedTokensForPegDex(
  userAddress,
  token,
  tokenAmount
) {
  const totalAllowedByUser = await getTokensAllowanceForPegDexFromUser(
    userAddress,
    token
  );
  return totalAllowedByUser.gte(tokenAmount);
}

export async function approveTokensToPegDex(tokenAddress, amount) {
  const signer = provider.getSigner();
  const contractInstance = new ethers.Contract(
    tokenAddress,
    tokenAbi.abi,
    signer
  );
  const tx = await contractInstance.approve(pegDexAbi.address, amount);
  const txReceipt = await provider.waitForTransaction(tx.hash, 3);
  return txReceipt.status;
}

export async function runSwap(
  tokenIn,
  tokenInAmount,
  tokenOut,
  tokenOutAmount
) {
  const signer = provider.getSigner();
  const pegDexWithSigner = pegDexContract.connect(signer);
  let tx;
  if (tokenIn === copContract) {
    tx = await pegDexWithSigner.swapCOPForTokens(
      tokenOut,
      tokenInAmount,
      getMinAmountOut(tokenOutAmount, 15),
      await getDeadline(20)
    );
  } else if (tokenIn !== wETHContract) {
    tx = await pegDexWithSigner.swapTokensForCOP(
      tokenIn,
      tokenInAmount,
      getMinAmountOut(tokenOutAmount, 15),
      await getDeadline(20)
    );
  } else if(tokenIn == tknContract) {
    tx = await pegDexWithSigner.swapReserveToToken(
      tokenIn,
      tokenInAmount,
      getMinAmountOut(tokenOutAmount, 15),
      await getDeadline(20)
    );
  }else{
    tx = await pegDexWithSigner.swapMaticForCOP(
      getMinAmountOut(tokenOutAmount, 15),
      await getDeadline(20),
      {
        value: tokenInAmount,
      }
    );
  }
  const txReceipt = await provider.waitForTransaction(tx.hash, 3);
  return { status: txReceipt.status, txHash: tx.hash };
}
