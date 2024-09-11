import * as readline from "readline";
import { buyMoonShot } from "./src/moonshotSwap";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  try {
    const ca = await askQuestion("Please insert Moonshot token CA: ");
    await buyMoonShot(ca);
    console.log("🎉 Done!");
    rl.close();
  } catch (err) {
    console.error("An error occurred:", err);
  }
}

main();
