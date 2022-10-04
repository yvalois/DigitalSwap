import digitalSwapAbi from "./tokens/digitalSwap.json";
import tokenList from "./tokens/tokenList.json";
import tokenAbi from "./tokens/tokenAbi.json";
import uniswapRouterAbi from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import { ethers } from "ethers";
import { Token, TokenAmount, Fetcher, Fraction, Percent } from "@uniswap/sdk";

export const digitalSwapContract = new ethers.Contract(
  digitalSwapAbi.address,
  digitalSwapAbi.abi
);

export const usdPriceDecimals = 8;
export const DcopTokenDecimals = 18;
export const usdTokenDecimals = 6;
export const chainId = 137;

const routerContractAddress = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

let provider;

export function setProvider(_provider) {
  provider = _provider;
}

/*const copContract = tokenList.find(
  (token) => token.symbol.toUpperCase() == "DLYCOP"
).address;*/
/*const wETHContract = tokenList.find(
  (token) => token.symbol.toUpperCase() === "MATIC"
).address; */
const uSDContract = tokenList.find(
  (token) => token.symbol.toUpperCase() === "USDC"
).address;
const usdContract = tokenList.find(
  (token) => token.symbol.toUpperCase() === "USDT"
).address;
const DcopContract = tokenList.find(
  (token) => token.symbol.toUpperCase() === "DCOP"
).address;

const routerInstance = new ethers.Contract(
  routerContractAddress,
  uniswapRouterAbi.abi
);

function usdToCop(usd, usdPrice) {
  return usd
    .mul(ethers.BigNumber.from(10).pow(usdPriceDecimals))
    .div(usdPrice)
    .mul(ethers.BigNumber.from(10).pow(DcopTokenDecimals - usdTokenDecimals));
}

function copToUsd(cop, usdPrice) {
  return cop
    .mul(usdPrice)
    .div(
      ethers.BigNumber.from(10).pow(
        usdPriceDecimals + DcopTokenDecimals - usdTokenDecimals
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
  return tokenContractInstance.allowance(userAddress, digitalSwapAbi.address);
}

function priceWithTRM(totalCopAmount, currentFee, usdTRM) {
  const amountWithFee = totalCopAmount.mul(ethers.BigNumber.from(1000).sub(3))
    .div(100);
  return 3000;
}

export async function calculateBurnPriceImpact(totalCOPAmount) {
  const pegDexWithProvider = digitalSwapContract.connect(provider);
  const [currentUsdOut, currentFee, usdTRM] = await Promise.all([
    pegDexWithProvider.getAmountOutInUSD(totalCOPAmount),
    pegDexWithProvider.BurnFee(),
    pegDexWithProvider.getLatestPrice(),
  ]);
  const usdPriceWithTRM = priceWithTRM(totalCOPAmount, currentFee, usdTRM);
  const fraction = new Fraction(currentUsdOut.mul(10), usdPriceWithTRM);
  const result = new Fraction(100, 1).subtract(fraction);
  return result.toFixed(2);
}

export async function calculateMintPriceImpact(totalCOPAmount) {
  const pegDexWithProvider = digitalSwapContract.connect(provider);
  const [currentUsdOut, currentFee, usdTRM] = await Promise.all([
    pegDexWithProvider.getAmountOutInUSD(totalCOPAmount),
    pegDexWithProvider.MintFee(),
    pegDexWithProvider.getLatestPrice(),
  ]);
  const usdPriceWithTRM = priceWithTRM(totalCOPAmount, currentFee, usdTRM);
  const fraction = new Fraction(currentUsdOut.mul(10), usdPriceWithTRM);
  const result = new Fraction(100, 1).subtract(fraction);
  return result.toFixed(2);
}

export async function isCOPToken(token) {
  return token === DcopContract;
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

//quitar comentarios para activar matic

export async function getAmountOut(fromToken, fromTokenInput, toToken) {
  const contractWithProvider = digitalSwapContract.connect(provider);
  if (fromToken == DcopContract) {
    return await fromRawAmountToPresentationAndRawValue(
      toToken,
      await contractWithProvider.swapDCOPForTokensPreview(toToken, fromTokenInput)
    );
    //return copToMatic(fromTokenInput);
  } /*else if (fromToken != wETHContract) {
    return await fromRawAmountToPresentationAndRawValue(
      toToken,
      await contractWithProvider.swapTokensForDCOPPreview(fromToken, fromTokenInput)
    );
  } */
  return await fromRawAmountToPresentationAndRawValue(
    toToken,
    // await contractWithProvider.swapMaticForDCOPPreview(fromTokenInput)
    await contractWithProvider.swapTokensForDCOPPreview(fromToken, fromTokenInput)
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
  const tx = await contractInstance.approve(digitalSwapAbi.address, amount);
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
  const pegDexWithSigner = digitalSwapContract.connect(signer);
  let tx;
  if (tokenIn === DcopContract) {
    tx = await pegDexWithSigner.swapDCOPForTokens(
      tokenOut,
      tokenInAmount,
      getMinAmountOut(tokenOutAmount, 10),
      await getDeadline(20),
    );
  } else if (tokenIn == usdContract || tokenIn == usdContract ) {
    tx = await pegDexWithSigner.swapTokensForDCOP(
      tokenIn,
      tokenInAmount,
      getMinAmountOut(tokenOutAmount, 15),
      await getDeadline(20));
  } else if(tokenIn == DcopContract) {
    tx = await pegDexWithSigner.swapReserveToToken(
      tokenIn,
      tokenInAmount,
      getMinAmountOut(tokenOutAmount, 15),
      await getDeadline(20)
    );
  }/*else{
    tx = await pegDexWithSigner.swapMaticForDCOP(
      getMinAmountOut(tokenOutAmount, 15),
      await getDeadline(20),
      {
        value: tokenInAmount,
      }
    );
  }*/
  const txReceipt = await provider.waitForTransaction(tx.hash, 3);
  return { status: txReceipt.status, txHash: tx.hash };
}
