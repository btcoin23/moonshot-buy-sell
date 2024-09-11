import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
dotenv.config();

export const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
export const connection = new Connection(RPC_URL, 'confirmed');

export const slippage = 50; //50%
export const jitoTip = 0.001 * LAMPORTS_PER_SOL;
export const buyAmount = 1 * LAMPORTS_PER_SOL;
export const tipAcc = new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5');

// Add your private keys here. Make sure they have sufficient SOL balance.
// Maximum wallet size: 15
export const wallets: string[] = [
    '',
    '',
    '',
    '',
    '',
]