import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
//import tokenList from "../tokens/tokenList.json";
import tokenList from "../tokens/tokenList.json";
import { DcopSymbol } from "../constants";

const currencies = tokenList;

export default function SelectTextFields({ field, form, meta, ...props }) {

  function setFieldValue(value) {
    form.setFieldValue(field.name, value);
  }

  const handleChange = (event) => {
    setFieldValue(event.target.value);
    setCurrency(event.target.value);
  };

  const currencyInputCurrentValue = form.getFieldMeta("currencyInput").value;

  const [currency, setCurrency] = React.useState("");

  useEffect(() => {
    let currencyValue = currencyInputCurrentValue !== DcopSymbol
      ? DcopSymbol
      : currency && currency !== DcopSymbol
      ? currency
      : currencies[0].symbol;
    setCurrency(currencyValue);
    setFieldValue(currencyValue);
  }, [currencyInputCurrentValue]);

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
          id="outlined-select-currency"
          select
          label="To"
          value={currency}
          onChange={handleChange}
          helperText="Please select your currency"
        >
          {currencies.map((option) => (
            <MenuItem key={option.symbol} value={option.symbol}>
              <img src={option.logoURI} height="25px" style={{"verticalAlign": "middle"}}></img>
              <span style={{"verticalAlign": "middle", "paddingLeft": "inherit"}}>{option.symbol}</span>
            </MenuItem>
          ))}
        </TextField>
      </div>
    </Box>
  );
}
