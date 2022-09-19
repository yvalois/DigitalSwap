import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { Web3Client } from '../utils/web3Client';

import { ethers } from "ethers";

export default function ConnectWalletButton({ setProviderCallback }) {

  React.useEffect(() => {
    async function validateConnection() {
      if (localStorage.getItem("WEB3_CONNECT_CACHED_PROVIDER")) {
        await web3Connect();
      } 
    }
    validateConnection();
  })

  async function web3Connect() {
    try {
      const web3Modal = Web3Client.getInstance();
      const instance = await web3Modal.connect();
      const provider = new ethers.providers.Web3Provider(instance);
      setProviderCallback(provider);
    } catch (error) {
      console.log(error);
    }
  }

  return (
      <div>
        <Button variant="outlined" size="large" onClick={web3Connect}>
          Connect Wallet
        </Button>
      </div>
  );
}

