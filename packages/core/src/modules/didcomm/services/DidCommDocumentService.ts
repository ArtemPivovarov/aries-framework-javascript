import type { Logger } from '../../../logger'
import type { ResolvedDidCommService } from '../types'

import { AgentConfig } from '../../../agent/AgentConfig'
import { KeyType } from '../../../crypto'
import { injectable } from '../../../plugins'
import { DidCommV1Service, IndyAgentService, keyReferenceToKey } from '../../dids/domain'
import { verkeyToInstanceOfKey } from '../../dids/helpers'
import { DidResolverService } from '../../dids/services/DidResolverService'
import { findMatchingEd25519Key } from '../util/matchingEd25519Key'

@injectable()
export class DidCommDocumentService {
  private logger: Logger
  private didResolverService: DidResolverService

  public constructor(agentConfig: AgentConfig, didResolverService: DidResolverService) {
    this.logger = agentConfig.logger
    this.didResolverService = didResolverService
  }

  public async resolveServicesFromDid(did?: string): Promise<ResolvedDidCommService[]> {
    if (!did) return []
    const didDocument = await this.didResolverService.resolveDidDocument(did)

    const didCommServices: ResolvedDidCommService[] = []

    // FIXME: we currently retrieve did documents for all didcomm services in the did document, and we don't have caching
    // yet so this will re-trigger ledger resolves for each one. Should we only resolve the first service, then the second service, etc...?
    for (const didCommService of didDocument.didCommServices) {
      if (didCommService instanceof IndyAgentService) {
        // IndyAgentService (DidComm v0) has keys encoded as raw publicKeyBase58 (verkeys)
        didCommServices.push({
          id: didCommService.id,
          recipientKeys: didCommService.recipientKeys.map(verkeyToInstanceOfKey),
          routingKeys: didCommService.routingKeys?.map(verkeyToInstanceOfKey) || [],
          serviceEndpoint: didCommService.serviceEndpoint,
        })
      } else if (didCommService instanceof DidCommV1Service) {
        // Resolve dids to DIDDocs to retrieve routingKeys
        const routingKeys = []
        for (const routingKey of didCommService.routingKeys ?? []) {
          const routingDidDocument = await this.didResolverService.resolveDidDocument(routingKey)
          routingKeys.push(keyReferenceToKey(routingDidDocument, routingKey))
        }

        // DidCommV1Service has keys encoded as key references

        // Dereference recipientKeys
        const recipientKeys = didCommService.recipientKeys.map((recipientKeyReference) => {
          const key = keyReferenceToKey(didDocument, recipientKeyReference)

          // try to find a matching Ed25519 key (https://sovrin-foundation.github.io/sovrin/spec/did-method-spec-template.html#did-document-notes)
          if (key.keyType === KeyType.X25519) {
            const matchingEd25519Key = findMatchingEd25519Key(key, didDocument)
            if (matchingEd25519Key) return matchingEd25519Key
          }
          return key
        })

        didCommServices.push({
          id: didCommService.id,
          recipientKeys,
          routingKeys,
          serviceEndpoint: didCommService.serviceEndpoint,
        })
      }
    }

    return didCommServices
  }
}
