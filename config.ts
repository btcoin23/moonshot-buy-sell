import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
dotenv.config();

export const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
export const connection = new Connection(RPC_URL, 'confirmed');

export const Slippage = 50; //50%
export const JitotipAmount = 0.001 * LAMPORTS_PER_SOL;
export const JitotipAcc = new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5');
export const BuySetting: {private_key: string, amount: number}[] = [
    { private_key: '', amount: 0.1 },
    { private_key: '', amount: 0.2 },
    { private_key: '', amount: 0.3 },
    { private_key: '', amount: 0.4 },
    { private_key: '', amount: 0.5 },
    { private_key: '', amount: 0.6 },
    { private_key: '', amount: 0.7 },
    { private_key: '', amount: 0.8 },
    { private_key: '', amount: 0.9 },
    { private_key: '', amount: 1.0 },
]