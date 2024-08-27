import { Moonshot, Environment } from "@wen-moon-ser/moonshot-sdk";
import {
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";

import {
  BuySetting,
  connection,
  JitotipAcc,
  JitotipAmount,
  RPC_URL,
  Slippage,
} from "../config";
import { JitoBundleService } from "./jito.bundle";

export const swapMoonShot = async (mint: string) => {
  const moonshot = new Moonshot({
    rpcUrl: RPC_URL,
    authToken: "YOUR_AUTH_TOKEN",
    environment: Environment.MAINNET,
  });

  const token = moonshot.Token({
    mintAddress: mint,
  });

  const curvePos = await token.getCurvePosition();
  const collateralPrice = await token.getCollateralPrice({
    tokenAmount: BigInt(1e9), // 1 token in minimal units
    curvePosition: curvePos,
  });
  const singleTokenPriceSol = Number(collateralPrice) / 1e9; // Convert lamports to SOL
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const buyInstructions: TransactionInstruction[] = [];
  BuySetting.forEach(async (setting) => {
    const keypair = Keypair.fromSecretKey(bs58.decode(setting.private_key));

    // Specify the amount in SOL you want to spend
    const tokensToBuy = Math.floor(setting.amount / singleTokenPriceSol);
    const splAmount = BigInt(tokensToBuy) * BigInt(1e9); // Convert to minimal units

    const solBal = await connection.getBalance(keypair.publicKey);
    if (solBal < setting.amount * LAMPORTS_PER_SOL + JitotipAmount)
      console.log("InsuInsufficient SOL balance", keypair.publicKey.toBase58());
    else{
      const collateralAmount = await token.getCollateralAmountByTokens({
        tokenAmount: splAmount,
        tradeDirection: "BUY",
      });
  
      const { ixs } = await token.prepareIxs({
        slippageBps: Slippage,
        creatorPK: keypair.publicKey.toBase58(),
        tokenAmount: splAmount,
        collateralAmount,
        tradeDirection: "BUY",
      });
      buyInstructions.push(...ixs);
    }
  });

  const tipKeypair = Keypair.fromSecretKey(
    bs58.decode(BuySetting[0].private_key)
  );

  const jitoTipIns = SystemProgram.transfer({
    fromPubkey: tipKeypair.publicKey,
    toPubkey: JitotipAcc,
    lamports: JitotipAmount,
  });

  const messageV0 = new TransactionMessage({
    payerKey: tipKeypair.publicKey,
    recentBlockhash: blockhash,
    instructions: [...buyInstructions, jitoTipIns],
  }).compileToV0Message();

  const txn = new VersionedTransaction(messageV0);

  txn.sign([tipKeypair]);
  const txId = getSignature(txn);

  const { value: simulatedTransactionResponse } =
    await connection.simulateTransaction(txn, {
      replaceRecentBlockhash: true,
      commitment: "processed",
    });
  const { err, logs } = simulatedTransactionResponse;

  console.log("🚀 Simulate ~", Date.now());

  if (err) {
    console.error("Simulation Error:");
    console.error({ err, logs });
    return;
  }

  const serializeTxBytes = txn.serialize();
  console.log("Txn size:", serializeTxBytes.length);
  const jitoBundleInstance = new JitoBundleService();
  const bundleId = await jitoBundleInstance.sendBundle(serializeTxBytes);
  if (!bundleId) return;
  console.log(
    `✨ BundleID: ${bundleId} Signature: https://solscan.io/tx/${txId}`
  );

  const isTxSucceed = await jitoBundleInstance.getBundleStatus(bundleId);
  if (isTxSucceed) console.log("🎉 Txn succeed:", Date.now());
  else console.error("❌ Txn failed:", Date.now());
};

function getSignature(transaction: Transaction | VersionedTransaction): string {
  const signature =
    "signature" in transaction
      ? transaction.signature
      : transaction.signatures[0];
  if (!signature) {
    throw new Error(
      "Missing transaction signature, the transaction was not signed by the fee payer"
    );
  }
  return bs58.encode(signature);
}
