import React, { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import { ethers } from "ethers";

import tokenList from "../tokens/tokenList.json";
import { getTokenBalanceForAddress, setProvider } from "../DigitalSwap";
import { Button, Tooltip } from "@mui/material";
import { useFormikContext } from "formik";

export default function CurrencyAmountInput({
  field,
  form,
  provider,
  error,
  setUserBalance,
  ...props
}) {
  const { values, setFieldValue, errors } = useFormikContext();
  const currencyInputCurrentValue = form.getFieldMeta("currencyInput").value;

  const [expandedUserBalance, setExpandedUserBalance] = useState("0");

  function handleChange(event) {
    let amountValue = values[field.name];
    if (!/[a-zA-Z]/g.test(event.target.value)) {
      amountValue = event.target.value;
    }
    setFieldValue(field.name, amountValue);
  }

  function getFormattedBalance() {
    const token = tokenList.find(
      (token) => token.symbol === currencyInputCurrentValue
    );
    const balance = ethers.utils.formatUnits(
      expandedUserBalance,
      token.decimals
    );
    const wholeNumbersLength = balance.split(".")[0].length;
    const maxLengthToShowFraction = "0.".length + token.decimals;
    if (balance.length > maxLengthToShowFraction) {
      const fractionDigits = token.decimals - (wholeNumbersLength - 1);
      return Number(balance).toFixed(fractionDigits < 0 ? 0 : fractionDigits);
    }
    return balance;
  }

  const handleSetMax = () => {
    const balance = getFormattedBalance();
    setFieldValue(field.name, balance);
  };

  useEffect(() => {
    async function load() {
      if (provider) {
        const address = await provider.getSigner().getAddress();
        setProvider(provider);
        const fromToken = tokenList.find(
          (token) => token.symbol == currencyInputCurrentValue
        );
        const balance =
          fromToken.symbol == "MATIC"
            ? await provider.getBalance(address)
            : await getTokenBalanceForAddress(fromToken.address, address);
        setExpandedUserBalance(balance);
        setUserBalance(ethers.utils.formatUnits(balance, fromToken.decimals));
      }
    }
    console.log(values)
    load();
  }, [provider, currencyInputCurrentValue, values]);

  return (
    <Box
      component="form"
      sx={{
        "& .MuiTextField-root": { m: 1, width: "25ch" },
      }}
      noValidate
      autoComplete="off"
    >
      <div>
        <TextField
          error={errors.currencyInputAmount ? true : false}
          id="outlined-input-currency-amount"
          label={`${currencyInputCurrentValue} amount`}
          value={values[field.name]}   
          onChange={handleChange}
          helperText={
            !errors.currencyInputAmount
              ? `Balance: ${getFormattedBalance()} ${values.currencyInput === 'DCOP' ? ' | Minimun value: 1000 DCOP' : ''}`
              : `${
                  errors.currencyInputAmount
                } | Balance : ${getFormattedBalance()}`
          }
          InputProps={{
            endAdornment: (
              <Tooltip title="Set all your balance" placement="right">
                <Button
                  size="small"
                  onClick={handleSetMax}
                  variant="contained"
                  style={{ fontSize: "0.5em", minWidth: "5em" }}
                >
                  Max
                </Button>
              </Tooltip>
            ),
          }}
        />
      </div>
    </Box>
  );
}
