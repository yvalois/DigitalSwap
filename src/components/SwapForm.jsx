import React, { useEffect, useState } from "react";

import { Formik, Field } from "formik";
import {
  Alert,
  Button,
  Chip,
  Tooltip,
  IconButton,
  Grid,
  Link,
} from "@mui/material";
import {
  AccountBalanceWallet,
  NoAccounts,
  LogoutOutlined,
} from "@mui/icons-material";

import CurrencyInput from "./CurrencyInput";
import CurrencyOutput from "./CurrencyOutput";
import ConnectWallet from "./ConnectWallet";
import SwapActions from "./SwapActions";
import { dailySymbol } from "../constants";
import tokenList from "../tokens/tokenList.json";
import CurrencyAmountInput from "./CurrencyAmountInput";
import { Web3Client } from "../utils/web3Client";

export default function SwapForm() {
  const [provider, setProvider] = useState(null);
  const [userBalance, setUserBalance] = useState("0");
  const [resultTxWrapper, setResultTxWrapper] = useState({
    success: null,
    resultData: null,
  });
  const [showAlert, setShowAlert] = useState(false);
  const [userAddres, setUserAddres] = useState(null);

  useEffect(() => {
    if (resultTxWrapper.success !== null) {
      setShowAlert(true);
      setTimeout(() => {
        setShowAlert(false);
      }, 15000);
    }
  }, [resultTxWrapper, setShowAlert]);

  useEffect(() => {
    async function getUserAddress() {
      if (provider) {
        setUserAddres(await provider.getSigner().getAddress());
      }
    }
    getUserAddress();
  }, [provider]);

  const initialValues = {
    currencyInput: dailySymbol,
    currencyInputAmount: 0,
    currencyOutput: tokenList[0].symbol,
  };

  const disconnectProvider = () => {
    const web3Client = Web3Client.getInstance();
    localStorage.removeItem(web3Client.cachedProvider);
    web3Client.clearCachedProvider();
    setProvider(null);
    setUserAddres(null);
  };

  const formatHashes = (hash, nCharacters) => {
    return `${hash.substring(0, nCharacters)}...${hash.substring(
      hash.length - nCharacters,
      hash.length
    )}`;
  };

  const setUpAlerts = (type, resultData) => {
    return (
      <Alert
        severity={type}
        style={{ marginBottom: "1em", textAlign: "center" }}
      >
        <div>{resultData.detail}</div>
        {resultData.txHash ? (
          <div>
            <Link
              href={resultData.txHashLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {formatHashes(resultData.txHash, 15)}
            </Link>
          </div>
        ) : null}
      </Alert>
    );
  };

  const AddressChip = () => {
    return (
      <Grid container style={{ marginTop: "0.3em", verticalAlign: "middle" }}>
        <Grid item xs={userAddres ? 11 : 12} style={{ width: "100%" }}>
          <Chip
            label={
              userAddres
                ? `Connected ${formatHashes(userAddres, 5)}`
                : "You are disconnected"
            }
            icon={
              userAddres ? (
                <AccountBalanceWallet fontSize="small" />
              ) : (
                <NoAccounts fontSize="small" />
              )
            }
            color={userAddres ? "success" : "error"}
            variant="outlined"
            style={{
              marginBottom: "2em",
            }}
          />
        </Grid>
        {userAddres ? (
          <Grid item xs={1}>
            <Tooltip
              title="Disconnect"
              style={{
                verticalAlign: "middle",
                padding: 0,
                marginTop: "0.2em",
              }}
              onClick={disconnectProvider}
            >
              <IconButton>
                <LogoutOutlined />
              </IconButton>
            </Tooltip>
          </Grid>
        ) : null}
      </Grid>
    );
  };

  return (
    <Formik
      initialValues={initialValues}
      validate={(values) => {
        const errors = {};
        if (!values.currencyInput.trim()) {
          errors.currencyInput = "This value is required";
        }
        if (!values.currencyOutput.trim()) {
          errors.currencyOutput = "This value is required";
        }
        if (provider && Number(values.currencyInputAmount) <= 0) {
          errors.currencyInputAmount = "Provide a valid value";
        }
        if (
          provider &&
          values.currencyInput === "DLYCOP" &&
          Number(values.currencyInputAmount) < 1000
        ) {
          errors.currencyInputAmount = "Minimun value 1000 DLYCOP";
        }
        if (provider && Number(values.currencyInputAmount) > userBalance) {
          errors.currencyInputAmount = "Insufficient balance";
        }
        return errors;
      }}
      onSubmit={(values, { setSubmitting }) => {
        setTimeout(() => {
          alert(JSON.stringify(values, null, 2));
          setSubmitting(false);
        }, 400);
      }}
    >
      <>
        {
          <div>
            <AddressChip />
          </div>
        }
        {showAlert &&
          setUpAlerts(
            resultTxWrapper.success ? "success" : "error",
            resultTxWrapper.resultData
          )}
        <div>
          <Field name="currencyInput" component={CurrencyInput} />
          <Field
            name="currencyInputAmount"
            provider={provider}
            setUserBalance={setUserBalance}
            component={CurrencyAmountInput}
          />
          <Field name="currencyOutput" component={CurrencyOutput} />
          <div style={{ textAlign: "center" }}>
            {provider ? (
              <SwapActions
                provider={provider}
                txResultWrapper={setResultTxWrapper}
                userBalance={userBalance}
              />
            ) : (
              <ConnectWallet setProviderCallback={setProvider} />
            )}
          </div>
        </div>
      </>
    </Formik>
  );
}
