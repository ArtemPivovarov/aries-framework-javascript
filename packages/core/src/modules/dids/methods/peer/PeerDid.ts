import type { DidDocument } from '../../domain'
import type { Key } from '../../domain/Key'
import type { ParsedDid } from '../../types'

import { instanceToInstance } from 'class-transformer'

import { JsonEncoder, MultiBaseEncoder, MultiHashEncoder } from '../../../../utils'
import { parseDid } from '../../domain/parse'

import { didToNumAlgo0DidDocument } from './peerDidNumAlgo0'
import { didDocumentToNumAlgo2Did, didToNumAlgo2DidDocument } from './peerDidNumAlgo2'
import { getNumAlgoFromPeerDid, PEER_DID_REGEX, PeerDidNumAlgo } from './utils'

export class PeerDid {
  private readonly parsedDid: ParsedDid

  // If numAlgo 1 is used, the did always has a did document
  private readonly _didDocument?: DidDocument

  private constructor({ didDocument, did }: { did: string; didDocument?: DidDocument }) {
    const parsed = parseDid(did)

    if (!this.isValidPeerDid(did)) {
      throw new Error(`Invalid peer did '${did}'`)
    }

    this.parsedDid = parsed
    this._didDocument = didDocument
  }

  public static fromKey(key: Key) {
    const did = `did:peer:0${key.fingerprint}`
    return new PeerDid({ did })
  }

  public static fromDid(did: string) {
    return new PeerDid({
      did,
    })
  }

  public static fromDidDocument(
    didDocument: DidDocument,
    numAlgo?:
      | PeerDidNumAlgo.GenesisDoc
      | PeerDidNumAlgo.InceptionKeyWithoutDoc
      | PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc
  ): PeerDid {
    if (!numAlgo && didDocument.id.startsWith('did:peer:')) {
      numAlgo = getNumAlgoFromPeerDid(didDocument.id)
    }

    if (!numAlgo) {
      throw new Error(
        'Could not determine numAlgo. The did document must either have a full id property containing the numAlgo, or the numAlgo must be provided as a separate property'
      )
    }

    if (numAlgo === PeerDidNumAlgo.GenesisDoc) {
      // FIXME: We should do this on the JSON value of the did document, as the DidDocument class
      // adds a lot of properties and default values that will mess with the hash value
      // Remove id from did document as the id should be generated without an id.
      const didDocumentBuffer = JsonEncoder.toBuffer({ ...didDocument.toJSON(), id: undefined })

      const didIdentifier = MultiBaseEncoder.encode(MultiHashEncoder.encode(didDocumentBuffer, 'sha2-256'), 'base58btc')

      const did = `did:peer:1${didIdentifier}`

      return new PeerDid({ did, didDocument })
    } else if (numAlgo === PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc) {
      const did = didDocumentToNumAlgo2Did(didDocument)
      return new PeerDid({ did })
    } else {
      throw new Error(`Unsupported numAlgo: ${numAlgo}. Not all peer did methods support parsing a did document`)
    }
  }

  public get did() {
    return this.parsedDid.did
  }

  public get numAlgo(): PeerDidNumAlgo {
    // numalgo is the first digit of the method specific identifier
    return Number(this.parsedDid.id[0]) as PeerDidNumAlgo
  }

  private get identifierWithoutNumAlgo() {
    return this.parsedDid.id.substring(1)
  }

  private isValidPeerDid(did: string): boolean {
    return PEER_DID_REGEX.test(did)
  }

  public get didDocument() {
    // Method 1 (numAlgo 0)
    if (this.numAlgo === PeerDidNumAlgo.InceptionKeyWithoutDoc) {
      return didToNumAlgo0DidDocument(this.parsedDid.did)
    }
    // Method 2 (numAlgo 1)
    else if (this.numAlgo === PeerDidNumAlgo.GenesisDoc) {
      if (!this._didDocument) {
        throw new Error('No did document provided for method 1 peer did')
      }

      // Clone the document, and set the id
      const didDocument = instanceToInstance(this._didDocument)
      didDocument.id = this.did

      return didDocument
    }
    // Method 3 (numAlgo 2)
    else if (this.numAlgo === PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc) {
      return didToNumAlgo2DidDocument(this.parsedDid.did)
    }

    throw new Error(`Unsupported numAlgo '${this.numAlgo}'`)
  }
}
