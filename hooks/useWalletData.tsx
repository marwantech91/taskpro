import { useEffect, useState, useRef } from "react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { toast } from "react-toastify";

const useWalletData = () => {
  const networkValue = process.env.NEXT_PUBLIC_NETWORK?.toString() || "devnet";
  const [network, setNetwork] = useState(networkValue);
  const [walletID, setWalletID] = useState("");
  const [connStatus, setConnStatus] = useState(false);
  const [signer, setSigner] = useState<PhantomWalletAdapter | null>(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    const solanaConnect = async () => {
      if (connectedRef.current === true) return;
      const { solana } = window as any;
      if (!solana) {
        alert("Please Install Solana Wallet");
      }

      try {
        const phantom = new PhantomWalletAdapter();
        setSigner(phantom);
        await phantom.connect();
        const wallet = {
          address: phantom.publicKey!.toString(),
        };

        if (wallet.address) {
          !connectedRef.current && toast.success("connected successfully");
          setWalletID(wallet.address);
          setConnStatus(true);
        }
        connectedRef.current = true;
      } catch (err) {
        toast.error("connection failed");
        console.log(err);
      }
    };
    solanaConnect();
  }, []);

  return {
    signer,
    network,
    setNetwork,
    walletID,
    setWalletID,
    connStatus,
    setConnStatus,
  };
};

export default useWalletData;
