import "core-js";
import "reflect-metadata";

import { TestingAppChain } from "@proto-kit/sdk";
import { Bool, Encoding, Field, Poseidon, PrivateKey, PublicKey, UInt64 } from "snarkyjs";
import { PrivateToken } from "../src/PrivateToken";
import { describe, expect, it, beforeEach } from "bun:test";
import { KeyPairs, deriveKeyPairs } from "../src/keyDerivation";
import { PRIVATE_KEY_0, PRIVATE_KEY_1 } from "./test_vectors/testVectors";
import { UTXO } from "../src/dataModel";


describe("Balances", () => {
  let privSpendKeyBase58Sender: string;
    let privSpendKeyBase58Receiver: string;
    let keyPairsSender: KeyPairs;
    let keyPairsReceiver: KeyPairs;
    let amount: Field;
    let token: Field;

    beforeEach(() => {
        privSpendKeyBase58Sender = PRIVATE_KEY_0;
        privSpendKeyBase58Receiver = PRIVATE_KEY_1;
        keyPairsSender = deriveKeyPairs(privSpendKeyBase58Sender);
        keyPairsReceiver = deriveKeyPairs(privSpendKeyBase58Receiver);
        amount = Field(1_000_000); // or any number you choose
        token = Poseidon.hash(Encoding.stringToFields('MINA'));
    });
  it("should demonstrate how adding UTxOs to the ledger works", async () => {

    const appChain = TestingAppChain.fromRuntime({
      modules: {
        PrivateToken,
      },
      config: {
        PrivateToken: {}
      },
    });

    await appChain.start();

    const alicePrivateKey = PrivateKey.fromBase58(privSpendKeyBase58Sender);
    const alice = alicePrivateKey.toPublicKey();

    appChain.setSigner(alicePrivateKey);
    // this is almost equivalent to obtaining the contract ABI in solidity
    const ledger = appChain.runtime.resolve("PrivateToken");
    // create UTxO
    const utxo = new UTXO(PublicKey.fromBase58(keyPairsSender.S), PublicKey.fromBase58(keyPairsSender.V), Field(100), token, Bool(false));
    console.log("constructing transaction");
    const tx1 = appChain.transaction(alice, () => {
      ledger.mintMyUtxo(PublicKey.fromBase58(keyPairsSender.S), PublicKey.fromBase58(keyPairsSender.V), Field(100), token, Bool(false));
    });
    console.log("signing transaction");
    
    await tx1.sign();
    await tx1.send();

    const startTime = new Date().getTime();
    const block1 = await appChain.produceBlock();
    const endTime = new Date().getTime();
    console.log(`Block Production time: ${endTime - startTime} milliseconds`);

    const aliceUTxO = await appChain.query.runtime.PrivateToken.ledger.get(
      alice
    );

    expect(block1?.txs[0].status, block1?.txs[0].statusMessage).toBe(true);
    expect(UTXO.toJSON(aliceUTxO!)).toBeDefined();
  });
});
