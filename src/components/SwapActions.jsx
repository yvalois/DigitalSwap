import React, { useEffect, useState } from "react";
import {
  Button,
  Box,
  TextField,
  CircularProgress,
  Chip,
  Tooltip,
  IconButton,
} from "@mui/material";
import { InfoOutlined } from "@mui/icons-material";
import Grid from "@mui/material/Grid";
import { ethers } from "ethers";

import {
  getAmountOut,
  setProvider,
  checkIfuserHasApprovedTokensForPegDex,
  approveTokensToPegDex,
  runSwap,
  isCOPToken,
  calculateBurnPriceImpact,
  calculateMintPriceImpact
} from "../DigitalSwap";
import tokenList from "../tokens/tokenList.json";

import { useFormikContext, Field } from "formik";

export default function SwapActions({
  provider,
  txResultWrapper,
  userBalance,
}) {
  const { values, setFieldValue } = useFormikContext();
  const [userAddress, setUserAddress] = useState("");
  const [isTokenApproved, setIsTokenApproved] = useState(false);
  const [isLloadingTx, setIsLoadingTx] = useState(false);
  const [txData, setTxData] = useState(null);
  const [impactData, setImpactData] = useState({
    percentageImpact: 0,
    impactStatus: "",
  });

  const isMaticTransaction = () => {
    return (
      txData &&
      txData.fromToken.name.toString().toLowerCase().includes("matic") &&
      txData.toToken.name.toString().toLowerCase().includes("daily")
    );
  };

  /* const isValidTokenAmount = () => {
    let isValidInputAmount = false;
    if (values.currencyInput === "DCOP") {
      isValidInputAmount = Number(values.currencyInputAmount) >= 1000;
    } else {
      isValidInputAmount = Number(values.currencyInputAmount) > 0;
    }
    return (
      isValidInputAmount &&
      Number(values.currencyInputAmount) <= Number(userBalance)
    );
  };*/

  async function initSwap() {
    try {
      const tokenAmount = getFromTokenExpandedAmount(
        txData.fromToken.decimals,
        txData.fromTokenAmount
      );
      const fromToken = txData.fromToken.address;
      const toToken = txData.toToken.address;
      setIsLoadingTx(true);
      const txResult = await runSwap(
        fromToken,
        tokenAmount,
        toToken,
        values.estimated
      );
      setIsLoadingTx(false);
      let alertContent = "Successful swap";
      let isSuccess = true;
      if (txResult.status !== 1) {
        isSuccess = false;
        alertContent = "Error running swap";
      }
      const txHashLink = `https://polygonscan.com/tx/${txResult.txHash}`;
      txResultWrapper({
        success: isSuccess,
        resultData: {
          detail: alertContent,
          txHashLink,
          txHash: txResult.txHash,
        },
      });
      setIsTokenApproved(false);
      setFieldValue("currencyInputAmount", 0);
      setFieldValue("estimated", 0);
    } catch (error) {
      console.error(error);
      setIsLoadingTx(false);
      setFieldValue("currencyInputAmount", 0);
      setFieldValue("estimated", 0);
      errorMapping(error);
    }
  }

  async function initApprove() {
    try {
      const tokenAmount = getFromTokenExpandedAmount(
        txData.fromToken.decimals,
        txData.fromTokenAmount
      );
      const tokenAddress = txData.fromToken.address;
      setIsLoadingTx(true);
      const txStatus = await approveTokensToPegDex(tokenAddress, tokenAmount);
      setIsLoadingTx(false);
      setIsTokenApproved(txStatus === 1);
    } catch (error) {
      setIsLoadingTx(false);
      errorMapping(error);
    }
  }

  function getFromTokenExpandedAmount(inputTokenDecimals, inputAmount) {
    return ethers.utils.parseUnits(inputAmount || "0", inputTokenDecimals);
  }

  const errorMapping = (error) => {
    try {
      const rawError = error.toString().toLowerCase();
      if (rawError.includes("canceled")) {
        txResultWrapper({
          success: false,
          resultData: {
            detail: "User canceled transaction",
            txHashLink: null,
            txHash: null,
          },
        });
      } else {
        txResultWrapper({
          success: false,
          resultData: {
            detail: "Error, please retry in a few seconds",
            txHashLink: null,
            txHash: null,
          },
        });
      }
    } catch (error) { }
  };

  function getTokensInfoFromFormData() {
    const fromToken = tokenList.find(
      (token) => token.symbol === values.currencyInput
    );
    const toToken = tokenList.find(
      (token) => token.symbol === values.currencyOutput
    );
    return {
      fromToken,
      toToken,
      fromTokenAmount: values.currencyInputAmount,
    };
  }

  const mapImpactStatus = (impactPercentage) => {
    try {
      return {
        percentageImpact: impactPercentage,
        impactStatus:
          impactPercentage < 3
            ? "success"
            : impactPercentage >= 3 && impactPercentage < 10
              ? "warning"
              : "error",
      };
    } catch (error) {
      errorMapping(error)
    }
  };

  useEffect(() => {
    async function load() {
      try {
       // if (isValidTokenAmount() && txData)
        if ( txData) {
          const address = await provider.getSigner().getAddress();
          setUserAddress(address);
          setProvider(provider);
          const tokenInputAmount = getFromTokenExpandedAmount(
            txData.fromToken.decimals,
            txData.fromTokenAmount
          );
          const outputAmount = await getAmountOut(
            txData.fromToken.address,
            tokenInputAmount,
            txData.toToken.address
          );
          const isCopToken = await isCOPToken(txData.fromToken.address);
          if (isCopToken) {
            const impactPercentage = await calculateBurnPriceImpact(tokenInputAmount);
            setImpactData(mapImpactStatus(impactPercentage));
          }else{
            const impactPercentage = await calculateMintPriceImpact(tokenInputAmount);
            setImpactData(mapImpactStatus(impactPercentage));
          }
          setFieldValue("estimated", outputAmount);
          const userHasAllowedTokens =
            await checkIfuserHasApprovedTokensForPegDex(
              address,
              txData.fromToken.address,
              tokenInputAmount
            );
          setIsTokenApproved(userHasAllowedTokens);
        }
      } catch (error) {
        errorMapping(error)
      }
    }
    load();
  }, [provider, txData]);

  useEffect(() => {
    setTxData(getTokensInfoFromFormData());
  }, [values.currencyInputAmount, values.currencyInput, values.currencyOutput]);

  return (
    <>
      <Box
        component="form"
        sx={{
          "& .MuiTextField-root": { m: 1, width: "25ch" },
        }}
        noValidate
        autoComplete="off"
      >
        <Field
          name="estimated"
          component={() => (
            <TextField
              id="outlined-select-currency"
              label="Estimated"
              value={values.estimated ? values.estimated.presentationValue : 0}
              contentEditable={false}
              helperText={values.estimated ? "Minimum tolerated to receive: " + values.estimated.presentationValue * 85 / 100 : "15% slippage tolerance"}
            ></TextField>
          )}
        />
        {/* values.estimated && values.currencyInput === "DCOP" ? (
          <div>
            <Chip
              icon={
                <Tooltip
                  title="The difference between the oracle price and estimated price due to trade size"
                  style={{ padding: 0 }}
                >
                  <IconButton>
                    <InfoOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              }
              style={{ paddingBottom: 0, paddingTop: 0, marginBottom: '1em' }}
              color={impactData.impactStatus}
              label={`Price Impact: ${impactData.percentageImpact}%`}
            />
          </div>
        ) : null */}
      </Box>
      {isLloadingTx && <CircularProgress />}
      <Grid container style={{ marginTop: "0.5em" }}>
        {!isMaticTransaction() && !isTokenApproved ? (
          <Grid item xs={6}>
            <Button
              onClick={initApprove}
              disabled={
                isLloadingTx
                  ? true
                  //: isValidTokenAmount() && !isTokenApproved
                  :  !isTokenApproved
                    ? false
                    : true
              }
              variant="contained"
            >
              Approve
            </Button>
          </Grid>
        ) : null}
        <Grid item xs={isMaticTransaction() || isTokenApproved ? 12 : 6}>
          <Button
            style={{ paddingLeft: "2em", paddingRight: "2em" }}
            className="swap-button"
            onClick={initSwap}
            disabled={ 
              isLloadingTx
                ? true
                : isMaticTransaction() 
                  ? false
                  : !isMaticTransaction() &&
                    isTokenApproved
                    ? false
                    : true
            }
            variant="contained"
          >
            Swap
          </Button>
        </Grid>
      </Grid>
    </>
  );
}
