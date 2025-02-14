import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DidRepository } from '../../dids/repository'
import type { OutOfBandServiceV2 } from '../../oob/OutOfBandServiceV2'
import type { RoutingService } from '../../routing/services/RoutingService'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { OutOfBandState } from '../../oob/domain/OutOfBandState'
import { DidExchangeRequestMessage } from '../messages'

export class DidExchangeRequestHandler implements Handler {
  private didExchangeProtocol: DidExchangeProtocol
  private outOfBandService: OutOfBandServiceV2
  private agentConfig: AgentConfig
  private routingService: RoutingService
  private didRepository: DidRepository
  public supportedMessages = [DidExchangeRequestMessage]

  public constructor(
    agentConfig: AgentConfig,
    didExchangeProtocol: DidExchangeProtocol,
    outOfBandService: OutOfBandServiceV2,
    routingService: RoutingService,
    didRepository: DidRepository
  ) {
    this.agentConfig = agentConfig
    this.didExchangeProtocol = didExchangeProtocol
    this.outOfBandService = outOfBandService
    this.routingService = routingService
    this.didRepository = didRepository
  }

  public async handle(messageContext: HandlerInboundMessage<DidExchangeRequestHandler>) {
    const { recipient, sender, message, connection } = messageContext

    if (!recipient || !sender) {
      throw new AriesFrameworkError('Unable to process connection request without senderKey or recipientKey')
    }

    if (!message.thread?.parentThreadId) {
      throw new AriesFrameworkError(`Message does not contain 'pthid' attribute`)
    }
    const outOfBandRecord = await this.outOfBandService.findByInvitationId(message.thread.parentThreadId)

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`OutOfBand record for message ID ${message.thread?.parentThreadId} not found!`)
    }

    if (connection && !outOfBandRecord.reusable) {
      throw new AriesFrameworkError(
        `Connection record for non-reusable out-of-band ${outOfBandRecord.id} already exists.`
      )
    }

    const didRecord = await this.didRepository.findByRecipientKey(sender)
    if (didRecord) {
      throw new AriesFrameworkError(`Did record for sender key ${sender} already exists.`)
    }

    // TODO Shouldn't we check also if the keys match the keys from oob invitation services?

    if (outOfBandRecord.state === OutOfBandState.Done) {
      throw new AriesFrameworkError(
        'Out-of-band record has been already processed and it does not accept any new requests'
      )
    }

    const connectionRecord = await this.didExchangeProtocol.processRequest(messageContext, outOfBandRecord)

    if (connectionRecord?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      // TODO We should add an option to not pass routing and therefore do not rotate keys and use the keys from the invitation
      // TODO: Allow rotation of keys used in the invitation for new ones not only when out-of-band is reusable
      const routing = outOfBandRecord.reusable ? await this.routingService.getRouting() : undefined

      const message = await this.didExchangeProtocol.createResponse(connectionRecord, outOfBandRecord, routing)
      return createOutboundMessage(connectionRecord, message, outOfBandRecord)
    }
  }
}
