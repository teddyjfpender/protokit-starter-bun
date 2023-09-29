import { Poseidon, Struct, PublicKey, Group, Scalar, Provable, Field, Encoding, Encryption, Bool, PrivateKey} from 'snarkyjs';
import { UTXOType } from './types';

/**
 * Represents an unspent transaction output (UTXO) in a blockchain-based system.
 * Contains cryptographic details and amount associated with the UTXO.
 */
export class UTXO extends Struct({
      oneTimeAddress: PublicKey,
      transactionPublicKey: PublicKey,
      amount: Field,
      Token: Field, 
      spent: Bool
    }) implements UTXOType {
  
      /**
       * Constructs a UTXO object.
       * @param publicSpendKey - The public spend key of the recipient.
       * @param publicViewKey - The public view key of the recipient.
       * @param amount - Amount of tokens in the UTXO.
       * @param Token - Token type or identifier.
       */
      constructor(publicSpendKey: PublicKey, publicViewKey: PublicKey, amount: Field, Token: Field) {
  
        // Generate a random private key for the transaction.
        const r = Provable.witness(Scalar, () => Scalar.random());
    
        // Compute the public key corresponding to r. This is R = r*G.
        const R = PublicKey.fromGroup(Group.generator.scale(r));
    
        // Compute the ephemeral key F. 
        const F = publicViewKey.toGroup().scale(r);
    
        // Calculate the shared secret ss = H(r*V) = H(v*R).
        const ss = Scalar.from(Poseidon.hash(F.toFields()).toBigInt());
    
        // Derive the one-time destination address, K.
        const K = Group.generator.scale(ss.toBigInt()).add(publicSpendKey.toGroup());
    
        super({
          oneTimeAddress: PublicKey.fromGroup(K),
          transactionPublicKey: R,
          amount: amount,
          Token: Token,
          spent: Bool(false)
        });
      }
  
      /**
       * Convert the UTXO object into its JSON representation.
       * @param utxo - The UTXO object.
       * @returns The JSON string representation of the UTXO.
       */
      toJSON(utxo: UTXOType) {
          return {
              oneTimeAddress: PublicKey.toBase58(utxo.oneTimeAddress),
              transactionPublicKey: PublicKey.toBase58(utxo.transactionPublicKey),
              amount: utxo.amount.toBigInt().toString(),
              Token: utxo.Token.toBigInt().toString(),
              spent: utxo.spent.toBoolean().toString()
          }
      }
  
      /**
       * Convert a JSON string into a UTXO object.
       * @param utxo - The JSON string representation of the UTXO.
       * @returns The UTXO object.
       */
      fromJSON(utxo: string) {
        const utxoObject = JSON.parse(utxo);
        const oneTimeAddress = PublicKey.fromBase58(utxoObject.oneTimeAddress); 
        const transactionPublicKey = PublicKey.fromBase58(utxoObject.transactionPublicKey);
        const amount = Field.from(utxoObject.amount);
        const Token = Field.from(utxoObject.Token);
        const spent = Bool(utxoObject.spent);
        return { oneTimeAddress, transactionPublicKey, amount, Token, spent} as UTXOType;
      }

      static undefinedUTxO() {
        return { oneTimeAddress: PublicKey.fromBase58("undefined"), transactionPublicKey: PublicKey.fromBase58("undefined"), amount: Field(0), Token: Field(0), spent: Bool(true) } as UTXOType;
    }
  }
  