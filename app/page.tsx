"use client";
import { BN } from "bn.js";
import {
  StreamflowSolana,
  GenericStreamClient,
  getBN,
  IChain,
  ICluster,
  ICreateStreamData,
  IGetOneData,
  IGetAllData,
  StreamType,
  StreamDirection,
  getNumberFromBN,
} from "@streamflow/stream";
import { Connection, GetProgramAccountsFilter } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useWallet } from "@/provider/WalletProvider";
import { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";

export default function Home() {
  const { walletID, signer } = useWallet();
  const network = process.env.NEXT_PUBLIC_NETWORK || "devnet";

  const [streams, setStreams] = useState<any[]>([]);
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [name, setName] = useState<string>("");
  const [tokensId, setTokensId] = useState<string[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string>("");

  const rpcEndpoint = "https://api.devnet.solana.com";
  const solanaConnection = useMemo(
    () => new Connection(rpcEndpoint),
    [rpcEndpoint]
  );
  console.log("Solana connection: ", solanaConnection);

  const client = new GenericStreamClient<IChain.Solana>({
    chain: IChain.Solana, // Blockchain
    clusterUrl: `https://api.${network}.solana.com`, // RPC cluster URL
    cluster: ICluster.Devnet, // (optional) (default: Mainnet)
    // ...rest chain specific params e.g. commitment for Solana
  });

  const solanaClient = new StreamflowSolana.SolanaStreamClient(
    "https://api.devnet.solana.com"
  );

  const createStreamParams: ICreateStreamData = {
    recipient: recipient, // Recipient address.
    tokenId: selectedTokenId, // Token mint address.
    start: Math.round(Date.now() / 1000) + 1000, // Timestamp (in seconds) when the stream/token vesting starts.
    amount: getBN(amount, 9), // depositing 100 tokens with 9 decimals mint.
    period: 1, // Time step (period) in seconds per which the unlocking occurs.
    cliff: Math.round(Date.now() / 1000) + 10000, // Vesting contract "cliff" timestamp in seconds.
    cliffAmount: getBN(amount, 9).sub(new BN(amount)), // Amount unlocked at the "cliff" timestamp.
    amountPerPeriod: getBN(amount, 9), // Release rate: how many tokens are unlocked per each period.
    name: name, // The stream name or subject.
    canTopup: false, // setting to FALSE will effectively create a vesting contract.
    cancelableBySender: true, // Whether or not sender can cancel the stream.
    cancelableByRecipient: false, // Whether or not recipient can cancel the stream.
    transferableBySender: true, // Whether or not sender can transfer the stream.
    transferableByRecipient: false, // Whether or not recipient can transfer the stream.
    automaticWithdrawal: false, // Whether or not a 3rd party (e.g. cron job, "cranker") can initiate a token withdraw/transfer.
    withdrawalFrequency: 10, // Relevant when automatic withdrawal is enabled. If greater than 0 our withdrawor will take care of withdrawals. If equal to 0 our withdrawor will skip, but everyone else can initiate withdrawals.
    partner: undefined, //  (optional) Partner's wallet address (string | null).
  };

  const solanaParams = {
    sender: signer, // SignerWalletAdapter or Keypair of Sender account
  };

  // console.log("solanaParams: ", solanaParams);

  const createStream = async () => {
    if (!walletID) {
      console.error("Cannot create stream without a wallet ID.");
      return;
    }
    // console.log("Creating stream...", walletID);
    try {
      const { ixs, txId, metadataId } = await client.create(
        createStreamParams,
        solanaParams
      ); // second argument differ depending on a chain
      // console.log(ixs, txId, metadataId);
      toast.success("stream created successfully");
    } catch (exception) {
      // handle exception
      toast.error(`stream creation failed ${exception}`);
      // console.log("Error: ", exception);
    }
  };
  // createStream();

  const getData = async () => {
    const data: IGetAllData = {
      address: walletID || "",
      type: StreamType.All,
      direction: StreamDirection.All,
    };

    try {
      const streams = await client.get(data);
      const streamData: any[] = [];
      streams
        .filter((s) => s[1].type === "payment")
        .map((stream) => {
          streamData.push({
            address: stream[0],
            name: stream[1].name.match(/^[^\u0000]+/),
            mint: stream[1].mint,
            amount: getNumberFromBN(stream[1].depositedAmount, 9),
            period: stream[1].period,
            cliff: stream[1].cliff,
            cliffAmount: getNumberFromBN(stream[1].cliffAmount, 9),
            amountPerPeriod: getNumberFromBN(stream[1].amountPerPeriod, 9),
            start: stream[1].start,
            end: stream[1].end,
            data: stream[1],
          });
        });
      setStreams(streamData);
      toast.success("streams loaded successfully");
      console.log("streams: ", streams, client);
    } catch (exception) {
      // handle exception
      toast.error(`streams loading failed ${exception}`);
      console.error("Listing Error: ", exception);
    }
  };

  useEffect(() => {
    const getTokenAccounts = async (
      wallet: string,
      solanaConnection: Connection
    ) => {
      const filters: GetProgramAccountsFilter[] = [
        {
          dataSize: 165, //size of account (bytes)
        },
        {
          memcmp: {
            offset: 32, //location of our query in the account (bytes)
            bytes: wallet, //our search criteria, a base58 encoded string
          },
        },
      ];
      const accounts = await solanaConnection.getParsedProgramAccounts(
        TOKEN_PROGRAM_ID, //new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
        { filters: filters }
      );
      console.log(
        `Found ${accounts.length} token account(s) for wallet ${wallet}.`
      );
      accounts.forEach((account, i) => {
        //Parse the account data
        const parsedAccountInfo: any = account.account.data;
        const mintAddress: string = parsedAccountInfo["parsed"]["info"]["mint"];
        const tokenBalance: number =
          parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];
        //Log results
        console.log(`Token Account No. ${i + 1}: ${account.pubkey.toString()}`);
        console.log(`--Token Mint: ${mintAddress}`);
        console.log(`--Token Balance: ${tokenBalance}`);
        console.log("Account data: ", account);
        if (tokenBalance > 0 && !tokensId.includes(mintAddress))
          setTokensId((tokensId: string[]) => [...tokensId, mintAddress]);
      });
    };

    if (walletID) {
      getTokenAccounts(walletID, solanaConnection);
    }
  }, [solanaConnection, tokensId, walletID]);

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h1 className="text-3xl font-bold">Streamflow MVP</h1>
      <div className="w-full flex mt-[50px]">
        <div className="w-1/2">
          <h3 className="text-2xl text-center">create stream</h3>
          <div className="flex flex-col justify-center mt-[30px] w-full px-[5vw]">
            <div className="flex justify-between items-center mb-5">
              <label htmlFor="wallet">recipient address</label>
              <input
                type="text"
                id="wallet"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="ml-[10px] rounded-md text-blue-600 p-2 w-[50%]"
              />
            </div>
            <div className="flex justify-between items-center mb-5">
              <label htmlFor="name">input stream&apos;s name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="ml-[10px] rounded-md text-blue-600 p-2 w-[50%]"
              />
            </div>

            <div className="flex justify-between items-center mb-5">
              <label htmlFor="token">select token</label>
              <select
                value={selectedTokenId}
                onChange={(e) => setSelectedTokenId(e.target.value)}
                className="ml-[10px] rounded-md text-blue-600 p-2 w-[50%]"
              >
                <option value="" disabled>
                  Select Token
                </option>
                {tokensId.map((tokenId) => (
                  <option key={tokenId} value={tokenId} className="p-2">
                    {tokenId}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-between items-center">
              <label htmlFor="amount">input amount(SOL)</label>
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="ml-[10px] rounded-md text-blue-600 p-2 w-[50%]"
              />
            </div>

            <button
              className="mt-[30px] rounded-full bg-blue-600 p-5 hover:bg-blue-400 active:bg-blue-700"
              onClick={() => createStream()}
            >
              create
            </button>
          </div>
        </div>
        <div className="w-1/2">
          <h3 className="text-2xl text-center">get streamData</h3>
          <div className="flex flex-col justify-center mt-[30px] w-full px-[5vw]">
            <button
              className="mt-[30px] rounded-full bg-blue-600 p-5 hover:bg-blue-400 active:bg-blue-700 mb-5"
              onClick={() => getData()}
            >
              get
            </button>
            <div className="p-5 rounded-md h-[500px] border-slate-500 border-2 overflow-auto">
              <h5 className="mb-5 text-2xl">Total Streams: {streams.length}</h5>
              {streams.map((stream, index) => (
                <div
                  key={stream.address}
                  className="flex flex-col justify-between mb-5"
                >
                  <p>stream&apos;s address: {stream.address}</p>
                  <p>stream&apos;s name: {stream.name}</p>
                  <p>stream&apos;s mint: {stream.mint}</p>
                  <p>stream&apos;s amount: {stream.amount} SOL</p>
                  <p>
                    stream&apos;s cliff:{" "}
                    {new Date(stream.cliff).toLocaleString("en-US", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                  <p>stream&apos;s cliffAmount: {stream.cliffAmount} SOL</p>
                  <p>
                    stream&apos;s amountPerPeriod: {stream.amountPerPeriod} SOL
                  </p>
                  <p>
                    stream&apos;s start:{" "}
                    {new Date(stream.start).toLocaleString("en-US", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}{" "}
                  </p>
                  <p>
                    stream&apos;s end:{" "}
                    {new Date(stream.end).toLocaleString("en-US", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}{" "}
                  </p>
                  {index !== streams.length - 1 && (
                    <hr className="border-slate-500 mt-5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
