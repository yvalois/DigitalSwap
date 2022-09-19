import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import { dailySymbol } from "../constants";

import tokenList from "../tokens/tokenList.json";
import { Icon } from '@mui/material';
import { useFormikContext } from 'formik';

const currencies = tokenList;

export default function SelectTextFields({ field, form, ...props }) {

  const {values, setFieldValue, resetForm} = useFormikContext();

  const handleChange = (event) => {
    setFieldValue(field.name, event.target.value);
    setFieldValue('currencyInputAmount', 0)
    setFieldValue('estimated', 0)
  };

  const currencyOutputCurrentValue = form.getFieldMeta("currencyOutput").value;

  /*useEffect(() => {
    let currencyValue = dailySymbol;

    if (currencyOutputCurrentValue === dailySymbol) {
      if (values[field.name] && values[field.name]  !== dailySymbol) {
        currencyValue = values[field.name] ;
      } else {
        currencyValue = currencies[0].symbol;
      }
    }
    setFieldValue(field.name, currencyValue);
  }, [currencyOutputCurrentValue]);*/


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
          label="From"
          value={values[field.name]}
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
