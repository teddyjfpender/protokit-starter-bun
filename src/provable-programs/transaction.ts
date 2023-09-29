import { Experimental, Group, Poseidon, PrivateKey, Provable, Scalar, Struct } from 'snarkyjs';
import { UTXO } from '../dataModel/dataModel'

/**
 * Represents the arguments used for constructing a transaction.
 * Holds the necessary information for both inputs and outputs.
 */
export class TxArgs extends Struct({
  /**
   * Transaction inputs. 
   * Note: Maximum of 2 inputs.
   * 
   */
  inputs: Provable.Array(UTXO, 2),

  /**
   * Transaction outputs. 
   * Note: Maximum of 2 outputs.
   * 
   */
  outputs: Provable.Array(UTXO, 2),
}) {

    /**
     * Constructs a `TxArgs` object.
     * @param inputs - Array of UTXOs that act as inputs for the transaction.
     * @param outputs - Array of UTXOs that act as outputs for the transaction.
     */
    constructor(inputs: UTXO[], outputs: UTXO[]) {
      super({ inputs, outputs });
    }

    /**
     * Retrieve the transaction inputs.
     * @returns Array of UTXOs used as inputs.
     */
    getInputs() {
      return this.inputs;
    }

    /**
     * Retrieve the transaction outputs.
     * @returns Array of UTXOs used as outputs.
     */
    getOutputs() {
      return this.outputs;
    }
}

/**
 * Represents the private arguments for a transaction. 
 * Holds cryptographic details that shouldn't be publicly visible.
 */

export class PrivateTxArgs extends Struct({
  /**
   * Shared secret scalars associated with transaction inputs.
   */
  sharedSecretScalarInput: Provable.Array(Scalar, 2),

  /**
   * The public view key of the sender.
   */
  publicViewKey: Group,

  /**
   * The public spend key of the sender.
   */
  publicSpendKey: Group,
}) {

    /**
     * Constructs a `PrivateTxArgs` object.
     * @param txArgs - The public transaction arguments.
     * @param privateSpendKey - The private spend key of the sender.
     */
  constructor(txArgs: TxArgs, privateSpendKey: PrivateKey) {
    const privateViewKey = PrivateKey.fromBigInt(Poseidon.hash(privateSpendKey.toFields()).toBigInt());
    // Function to compute shared secrets for an array of UTXOs
    const computeSharedSecrets = (utxos: UTXO[]) => {
      const ss: Scalar[] = [];
      
      for (const utxo of utxos) {
        const R = utxo.transactionPublicKey
        const scalarSs = Scalar.from(Poseidon.hash((R.toGroup().scale(privateViewKey.s)).toFields()).toBigInt())

        ss.push(scalarSs);
      }

      return { ss };
    }

    const { ss: ssInput } = computeSharedSecrets(txArgs.getInputs());

    super({ 
      sharedSecretScalarInput: ssInput,
      publicViewKey: privateViewKey.toPublicKey().toGroup(),
      publicSpendKey: privateSpendKey.toPublicKey().toGroup()
    });
  }
}


/**
 * Represents a Zero-Knowledge (ZK) program that constraints the spending of UTxOs.
 * Contains methods that allow transaction validation and proving.
 */
export const Transaction = Experimental.ZkProgram({
  /** Public inputs of the transaction. */
  publicInput: TxArgs,

  /** Public outputs of the transaction. */
  publicOutput: TxArgs,

  methods: {
    spend: {
      /** Private inputs used for proving ownership and transaction validity. */
      privateInputs: [PrivateTxArgs],

      /**
       * Execute the 'spend' transaction method.
       * @param publicInputs - Public inputs for the transaction.
       * @param privateInputs - Private inputs for the transaction.
       * @returns The public inputs of the transaction.
       */
      method(publicInputs: TxArgs, privateInputs: PrivateTxArgs): TxArgs {
        
        for (let i = 0; i < publicInputs.getInputs().length; i++) {
          // Proving ownership of the input
          const derivedOneTimeAddress = Group.generator.scale(privateInputs.sharedSecretScalarInput[i]).add(privateInputs.publicSpendKey);
          derivedOneTimeAddress.assertEquals(publicInputs.getInputs()[i].oneTimeAddress.toGroup(), "Ownership proof failed for input " + i);
        }
        // Ensure value conservation
        const valueInputs = publicInputs.getInputs().map((utxo) => utxo.amount).reduce((a, b) => a.add(b));
        const valueOutputs = publicInputs.getOutputs().map((utxo) => utxo.amount).reduce((a, b) => a.add(b));

        // Ensure the tokens are conserved
        const tokenInputs = publicInputs.getInputs().map((utxo) => utxo.Token).reduce((a, b) => a.add(b));
        const tokenOutputs = publicInputs.getOutputs().map((utxo) => utxo.Token).reduce((a, b) => a.add(b));

        valueInputs.assertEquals(valueOutputs, "Value conservation failed");
        tokenInputs.assertEquals(tokenOutputs, "Token conservation failed");

        return publicInputs;
      },
    },
  },
});



/**
 * Represents a proof for the `Transaction` ZkProgram.
 * Holds necessary data for proving a transaction's validity without revealing private details.
 */
export class TransactionProof extends Experimental.ZkProgram.Proof(Transaction){
  static publicInput = this.prototype.publicInput;
  static publicOutput = this.prototype.publicOutput;
};