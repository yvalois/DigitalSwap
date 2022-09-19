import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";

export const Web3Client = ( () => {
    let web3Instance ;
    const createInstance = () => {
        const providerOptions = {
            walletconnect: {
              package: WalletConnectProvider, // required
              options: {
                rpc: {
                  8001: "https://rpc-mumbai.maticvigil.com",
                  //137: "https://polygon-mainnet.g.alchemy.com/v2/eeHRYg1mO5EI03UL5QjY2vTRVUWpddma",
                },
                chainId: 8001,
              },
            },
          };
          return new Web3Modal({
            network: "matic", // optional
            cacheProvider: true, // optional
            providerOptions, // required
        });
    }

    return  {
        getInstance: () => {
            if (!web3Instance) {
                web3Instance = createInstance();
            }
            return web3Instance;
        }
    }
})();
