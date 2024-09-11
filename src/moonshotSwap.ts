import {
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  PublicKey,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import bs58 from "bs58";

import {
  wallets,
  connection,
  tipAcc,
  jitoTip,
  buyAmount,
  slippage,
} from "../config";
import { JitoBundleService } from "./jito.bundle";

export const buyMoonShot = async (mint: string) => {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tipKeypair = Keypair.fromSecretKey(bs58.decode(wallets[0]));
  const rawTxns: Uint8Array[] = [];
  const chunk = 3;
  for (let i = 0; i < wallets.length; i += chunk) {
    const isLastTxn = wallets.length - i <= chunk;
    const buyInstructions: TransactionInstruction[] = [];
    const lookupTableAccounts: AddressLookupTableAccount[] = [];
    for (let j = i; j < Math.min(wallets.length, (i + chunk)); j++) {
      const keypair = Keypair.fromSecretKey(bs58.decode(wallets[j]));
      const solBal = await connection.getBalance(keypair.publicKey);
      if (solBal < buyAmount + jitoTip)
        console.log(
          "InsuInsufficient SOL balance",
          keypair.publicKey.toBase58()
        );
      else {
        const { txnIns, luts } = await jupiterSwap(
          keypair.publicKey.toBase58(),
          mint,
          buyAmount,
          slippage
        );
        // console.log({txnIns});
        buyInstructions.push(...txnIns);
        lookupTableAccounts.push(...luts);
      }
    }

    if (isLastTxn) {
      const jitoTipIns = SystemProgram.transfer({
        fromPubkey: tipKeypair.publicKey,
        toPubkey: tipAcc,
        lamports: jitoTip,
      });
      buyInstructions.push(jitoTipIns);
      console.log('- Jito tip is added;');
    }

    const messageV0 = new TransactionMessage({
      payerKey: tipKeypair.publicKey,
      recentBlockhash: blockhash,
      instructions: [...buyInstructions],
    }).compileToV0Message(lookupTableAccounts);

    const txn = new VersionedTransaction(messageV0);

    txn.sign([tipKeypair]);
    // const { value: simulatedTransactionResponse } =
    // await connection.simulateTransaction(txn, {
    //   replaceRecentBlockhash: true,
    //   commitment: "processed",
    // });
    // const { err, logs } = simulatedTransactionResponse;

    // console.log("🚀 Simulate ~", Date.now());

    // if (err) {
    //   console.error("Simulation Error:");
    //   console.error({ err, logs });
    //   return;
    // }
    const serializeTxBytes = txn.serialize();

    console.log("Txn size:", serializeTxBytes.length);

    rawTxns.push(serializeTxBytes);
  }
  

  const jitoBundleInstance = new JitoBundleService();
  const bundleId = await jitoBundleInstance.sendBundle(rawTxns);
  if (!bundleId) return;
  console.log(`✨ BundleID: ${bundleId}`);

  const isTxSucceed = await jitoBundleInstance.getBundleStatus(bundleId);
  if (isTxSucceed) console.log("🎉 Txn succeed:", Date.now());
  else console.error("❌ Txn failed:", Date.now());
};

export const jupiterSwap = async (
  wallet: string,
  mint: string,
  amount: number,
  slippage: number = 100
): Promise<{
  txnIns: TransactionInstruction[];
  luts: AddressLookupTableAccount[];
}> => {
  try {
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112\&outputMint=${mint}\&amount=${amount}\&slippageBps=${slippage * 100}`;
    // console.log({ url });
    const quoteResponse = await (await fetch(url)).json();
    //   console.log({ quoteResponse });

    const instructions = await (
      await fetch("https://quote-api.jup.ag/v6/swap-instructions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // quoteResponse from /quote api
          quoteResponse,
          userPublicKey: wallet,
          wrapAndUnwrapSol: true,
        }),
      })
    ).json();

    const {
      tokenLedgerInstruction, // If you are using `useTokenLedger = true`.
      computeBudgetInstructions, // The necessary instructions to setup the compute budget.
      setupInstructions, // Setup missing ATA for the users.
      swapInstruction: swapInstructionPayload, // The actual swap instruction.
      cleanupInstruction, // Unwrap the SOL if `wrapAndUnwrapSol = true`.
      addressLookupTableAddresses, // The lookup table addresses that you can use if you are using versioned transaction.
    } = instructions;

    const deserializeInstruction = (instruction: any) => {
      return new TransactionInstruction({
        programId: new PublicKey(instruction.programId),
        keys: instruction.accounts.map((key: any) => ({
          pubkey: new PublicKey(key.pubkey),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
        data: Buffer.from(instruction.data, "base64"),
      });
    };

    const getAddressLookupTableAccounts = async (
      keys: string[]
    ): Promise<AddressLookupTableAccount[]> => {
      const addressLookupTableAccountInfos =
        await connection.getMultipleAccountsInfo(
          keys.map((key) => new PublicKey(key))
        );

      return addressLookupTableAccountInfos.reduce(
        (acc, accountInfo, index) => {
          const addressLookupTableAddress = keys[index];
          if (accountInfo) {
            const addressLookupTableAccount = new AddressLookupTableAccount({
              key: new PublicKey(addressLookupTableAddress),
              state: AddressLookupTableAccount.deserialize(accountInfo.data),
            });
            acc.push(addressLookupTableAccount);
          }

          return acc;
        },
        new Array<AddressLookupTableAccount>()
      );
    };

    const luts: AddressLookupTableAccount[] =
      await getAddressLookupTableAccounts(addressLookupTableAddresses);
    // console.log({luts});
    const txnIns: TransactionInstruction[] = [
      ...setupInstructions.map(deserializeInstruction),
      deserializeInstruction(swapInstructionPayload),
      deserializeInstruction(cleanupInstruction),

    ];
    return { txnIns, luts };
   
  } catch (e) {
    console.error("* Error while swaping token, retrying after 1000ms");
    await sleepTime(1000);
    return await jupiterSwap(wallet, mint, amount);
  }
};

const sleepTime = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
