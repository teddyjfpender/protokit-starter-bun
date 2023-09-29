import { PublicKey, Field, Bool } from 'snarkyjs';

/**
 * Represents an unspent transaction output (UTXO) type.
 */
export interface UTXOType {
    /** 
     * The one-time destination address, derived from the transaction secret and recipient view key. 
     */
    oneTimeAddress: PublicKey;
  
    /** 
     * Ephemeral public key used in the transaction. Typically denoted as R = r*G. 
     */
    transactionPublicKey: PublicKey;
  
    /** 
     * The amount of tokens in this UTXO. 
     */
    amount: Field;
  
    /** 
     * Token type or identifier. 
     */
    Token: Field;

    /**
     * Whether or not the UTXO has been spent.
     */
    spent: Bool
  }