import {
    runtimeMethod,
    RuntimeModule,
    runtimeModule,
    state,
} from "@proto-kit/module";
import { assert, StateMap } from "@proto-kit/protocol";
import { Bool, Field, PublicKey } from "snarkyjs";
import { UTXO } from "./dataModel/dataModel";
import { TransactionProof } from "./provable-programs/transaction";
  
 /**
   * Configuration interface for the Private Token module.
   */
 interface LedgerConfig {

  }

@runtimeModule()
export class PrivateToken extends RuntimeModule<unknown> {
    // unspent utxos
    // the public key is the transaction public key of the utxo
    @state() public ledger = StateMap.from<PublicKey, UTXO>(PublicKey, UTXO);

    @runtimeMethod()
    public mintMyUtxo( oneTimeAddress: PublicKey, transactionPublicKey: PublicKey, amount: Field, Token: Field, spent: Bool) {
        this.ledger.set(transactionPublicKey, new UTXO(oneTimeAddress, transactionPublicKey, amount, Token, spent));
    }
  
    @runtimeMethod()
    public spendUtxo(transactionProof: TransactionProof) {
    // check if input utxos in the proof are unspent
    const inputs = transactionProof.publicInput.getInputs();

    const utxo0 = this.ledger.get(inputs[0].transactionPublicKey).orElse(UTXO.undefinedUTxO() as UTXO);
    const utxo1 = this.ledger.get(inputs[1].transactionPublicKey).orElse(UTXO.undefinedUTxO() as UTXO);
    // assert that the Option<utxo>s are unspent
    assert(
        // TODO: check if this is the correct way to check if the utxo is unspent
        utxo0.spent.equals(false),
        "UTXO is not unspent"
    );
    assert(
        // TODO: check if this is the correct way to check if the utxo is unspent
        utxo1.spent.equals(false),
        "UTXO is not unspent"
    );

    transactionProof.verify();
  
    // add new utxos to the ledger
    const outputs = transactionProof.publicInput.getOutputs();
    this.ledger.set(outputs[0].transactionPublicKey, outputs[0]);
    this.ledger.set(outputs[1].transactionPublicKey, outputs[1]);
    }
  }