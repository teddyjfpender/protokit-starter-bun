import "core-js";
import "reflect-metadata";

import { describe, expect, it, beforeEach } from "bun:test";
import { Encoding, Field, Group, Poseidon, PrivateKey, PublicKey, Scalar, verify } from 'snarkyjs';
import { KeyPairs, deriveKeyPairs } from '../../src/keyDerivation';
import { PRIVATE_KEY_0, PRIVATE_KEY_1 } from '../test_vectors/testVectors';
import { UTXO } from '../../src/dataModel';
import { PrivateTxArgs, Transaction, TransactionProof, TxArgs } from '../../src/provable-programs';

/**
 * Note: when running these tests
 * ensure you provide a timeout, e.g.: bun test --timeout 500000
 */
describe('UTXO Tests', () => {
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
    it('should create a UTXO convert it to JSON and back', () => {
        const utxo = new UTXO(PublicKey.fromBase58(keyPairsSender.S), PublicKey.fromBase58(keyPairsSender.V), amount, token);
        expect(utxo).toBeDefined();
        const utxoJSON = UTXO.toJSON(utxo);
        expect(utxoJSON).toBeDefined();
        const utxoFromJSON = UTXO.fromJSON(utxoJSON);
        expect(utxoFromJSON).toBeDefined();
        expect(utxoFromJSON.oneTimeAddress).toEqual(utxo.oneTimeAddress);
    });
    it('should create a transaction with 2 inputs and 2 outputs', () => {
        // Create 2 UTXOs -- these are spendable b
        const utxo1 = new UTXO(PublicKey.fromBase58(keyPairsSender.S), PublicKey.fromBase58(keyPairsSender.V), amount, token);
        const utxo2 = new UTXO(PublicKey.fromBase58(keyPairsSender.S), PublicKey.fromBase58(keyPairsSender.V), amount, token);

        // Create 2 outputs
        const output1 = new UTXO(PublicKey.fromBase58(keyPairsSender.S), PublicKey.fromBase58(keyPairsSender.V), amount, token);
        const output2 = new UTXO(PublicKey.fromBase58(keyPairsSender.S), PublicKey.fromBase58(keyPairsSender.V), amount, token);

        // Create a transaction public inputs and outputs
        const tx = new TxArgs([utxo1, utxo2], [output1, output2]);
        expect(tx).toBeDefined();
        expect(tx.inputs.length).toEqual(2);
        expect(tx.outputs.length).toEqual(2);

        // Create a transaction private inputs
        const txPrivateArgs = new PrivateTxArgs(tx, PrivateKey.fromBase58(keyPairsSender.v));
        expect(txPrivateArgs).toBeDefined();
        expect(txPrivateArgs.sharedSecretScalarInput.length).toEqual(2);
    });
    it('should check if the spender of the UTxO is the owner', () => {
        // Create 2 UTXOs -- these are spendable by the sender
        const utxo1 = new UTXO(PublicKey.fromBase58(keyPairsSender.S), PublicKey.fromBase58(keyPairsSender.V), Field(100), token);
        const utxo2 = new UTXO(PublicKey.fromBase58(keyPairsSender.S), PublicKey.fromBase58(keyPairsSender.V), Field(50), token);

        // Create 2 outputs
        const output1 = new UTXO(PublicKey.fromBase58(keyPairsReceiver.S), PublicKey.fromBase58(keyPairsReceiver.V), Field(140), token);
        const output2 = new UTXO(PublicKey.fromBase58(keyPairsReceiver.S), PublicKey.fromBase58(keyPairsReceiver.V), Field(10), token);

        // Create a transaction public inputs and outputs
        const tx = new TxArgs([utxo1, utxo2], [output1, output2]);
        expect(tx).toBeDefined();
        expect(tx.inputs.length).toEqual(2);
        expect(tx.outputs.length).toEqual(2);

        // create private key type
        const privateViewKey = PrivateKey.fromBase58(keyPairsSender.v);
        const publicSpendKey = PublicKey.fromBase58(keyPairsSender.S);

        const computeSharedSecrets = (utxos: UTXO[]) => {
            const ss: Scalar[] = [];
            
            for (const utxo of utxos) {
              const R = utxo.transactionPublicKey
              const scalarSs = Scalar.from(Poseidon.hash((R.toGroup().scale(privateViewKey.s)).toFields()).toBigInt())
      
              ss.push(scalarSs);
            }
      
            return { ss };
          }
      
          const { ss: ssInput } = computeSharedSecrets(tx.getInputs());

          for (let i = 0; i < tx.getInputs().length; i++) {
            // Proving ownership of the input
            const derivedOneTimeAddress = Group.generator.scale(ssInput[i]).add(publicSpendKey.toGroup());
            derivedOneTimeAddress.assertEquals(tx.getInputs()[i].oneTimeAddress.toGroup(), "Ownership proof failed for input " + i);
          }
    });
    
    it('should create a transaction with 2 inputs and 2 outputs, compile the transaction program and proof should be valid', async () => {
        // Create 2 UTXOs -- these are spendable by the sender
        const utxo1 = new UTXO(PublicKey.fromBase58(keyPairsSender.S), PublicKey.fromBase58(keyPairsSender.V), Field(100), token);
        const utxo2 = new UTXO(PublicKey.fromBase58(keyPairsSender.S), PublicKey.fromBase58(keyPairsSender.V), Field(50), token);

        // Create 2 outputs
        const output1 = new UTXO(PublicKey.fromBase58(keyPairsReceiver.S), PublicKey.fromBase58(keyPairsReceiver.V), Field(140), token);
        const output2 = new UTXO(PublicKey.fromBase58(keyPairsReceiver.S), PublicKey.fromBase58(keyPairsReceiver.V), Field(10), token);

        // Create a transaction public inputs and outputs
        const tx = new TxArgs([utxo1, utxo2], [output1, output2]);
        expect(tx).toBeDefined();
        expect(tx.inputs.length).toEqual(2);
        expect(tx.outputs.length).toEqual(2);

        // Create a transaction private inputs
        const txPrivateArgs = new PrivateTxArgs(tx, PrivateKey.fromBase58(keyPairsSender.s));
        expect(txPrivateArgs).toBeDefined();
        expect(txPrivateArgs.sharedSecretScalarInput.length).toEqual(2);

        // Compile the transaction program
        console.log('Compiling the transaction program...');
        const { verificationKey } = await Transaction.compile();
        console.log('Transaction program compiled successfully.');

        // Create a proof
        console.log('Creating a proof...');
        const startTime = new Date().getTime(); // Record the start time
        const proof = await Transaction.spend(tx, txPrivateArgs) as TransactionProof;
        const endTime = new Date().getTime(); // Record the end time
        console.log('Proof created. Time taken: ' + (endTime - startTime) + 'ms');

        // Verify the proof
        console.log('Verifying the proof...');
        const result = await verify(proof, verificationKey);
        expect(result).toBeTruthy();

        // Check the proof inputs and outputs
        const inputs = proof.publicInput.getInputs();
        const outputs = proof.publicInput.getOutputs();
        expect(inputs.length).toEqual(2);
        expect(outputs.length).toEqual(2);
        expect(inputs[0].oneTimeAddress).toEqual(utxo1.oneTimeAddress);
        expect(inputs[1].oneTimeAddress).toEqual(utxo2.oneTimeAddress);
        expect(outputs[0].oneTimeAddress).toEqual(output1.oneTimeAddress);
        expect(outputs[1].oneTimeAddress).toEqual(output2.oneTimeAddress);
    });
});