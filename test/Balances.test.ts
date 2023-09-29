import "core-js";
import "reflect-metadata";

import { TestingAppChain } from "@proto-kit/sdk";
import { PrivateKey, PublicKey, UInt64 } from "snarkyjs";
import { Balances } from "../src/Balances";
import { describe, expect, it } from "bun:test";


describe("Balances", () => {
  it("should demonstrate how balances work", async () => {
    const totalSupply = UInt64.from(10_000);

    const appChain = TestingAppChain.fromRuntime({
      modules: {
        Balances,
      },
      config: {
        Balances: {
          totalSupply,
        },
      },
    });

    await appChain.start();

    const alicePrivateKey = PrivateKey.random();
    const alice = alicePrivateKey.toPublicKey();

    appChain.setSigner(alicePrivateKey);
    // this is almost equivalent to obtaining the contract ABI in solidity
    const balances = appChain.runtime.resolve("Balances");

    const tx1 = appChain.transaction(alice, () => {
      balances.setBalance(alice, UInt64.from(1000));
    });

    await tx1.sign();
    await tx1.send();

    const startTime = new Date().getTime();
    const block1 = await appChain.produceBlock();
    const endTime = new Date().getTime();
    console.log(`Block Production time: ${endTime - startTime} milliseconds`);

    const aliceBalance = await appChain.query.runtime.Balances.balances.get(
      alice
    );

    expect(block1?.txs[0].status, block1?.txs[0].statusMessage).toBe(true);
    expect(aliceBalance?.toBigInt()).toBe(1000n);

    // send tokens to Bob
    const bobPrivateKey = PrivateKey.random();
    const mikePrivateKey = PrivateKey.random();
    const alanPrivateKey = PrivateKey.random();
    const stevePrivateKey = PrivateKey.random();
    
    function sendTokensToPublicKey(publicKey: PublicKey, amount: UInt64, nonce: number = 0) {
        const tx = appChain.transaction(alice, () => {
          balances.sendTo(publicKey, amount);
        },
        {nonce: nonce}
        );
  
        return tx;
      }

    const tx2 = sendTokensToPublicKey(bobPrivateKey.toPublicKey(), UInt64.from(100), 1);
    await tx2.sign();
    await tx2.send();

    const tx3 = sendTokensToPublicKey(mikePrivateKey.toPublicKey(), UInt64.from(100), 2);
    await tx3.sign();
    await tx3.send();

    const tx4 = sendTokensToPublicKey(alanPrivateKey.toPublicKey(), UInt64.from(100), 3);
    await tx4.sign();
    await tx4.send();

    const tx5 = sendTokensToPublicKey(stevePrivateKey.toPublicKey(), UInt64.from(100), 4);
    await tx5.sign();
    await tx5.send();

    const startTimeTx = new Date().getTime();
    const block2 = await appChain.produceBlock();
    const endTimeTx = new Date().getTime();
    console.log(`Block Production time (4 txs): ${startTimeTx - endTimeTx} milliseconds`);

    // check bob has 100 tokens
    const bobBalance = await appChain.query.runtime.Balances.balances.get(
      bobPrivateKey.toPublicKey()
    )

    expect(bobBalance?.toBigInt()).toBe(100n);
  });
});
