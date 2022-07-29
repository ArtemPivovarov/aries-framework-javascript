import type { OutOfBandEvent } from '../OutOfBandEvents'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { DidService } from '../../dids'
import { WellKnownService } from '../../well-known'
import { OutOfBandEventTypes } from '../OutOfBandEvents'
import {
  AndroidNearbyHandshakeAttachment,
  PaymentOfferAttachment,
  OutOfBandGoalCode,
  OutOfBandInvitationMessage,
} from '../messages'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandService {
  private agentConfig: AgentConfig
  private didService: DidService
  private wellKnownService: WellKnownService
  private eventEmitter: EventEmitter

  public constructor(
    agentConfig: AgentConfig,
    didService: DidService,
    wellKnownService: WellKnownService,
    eventEmitter: EventEmitter
  ) {
    this.agentConfig = agentConfig
    this.didService = didService
    this.wellKnownService = wellKnownService
    this.eventEmitter = eventEmitter
  }

  public async createOutOfBandInvitation({
    goal,
    goalCode,
    attachments,
    usePublicDid,
  }: {
    goalCode: string
    goal?: string
    attachments?: Record<string, unknown>[]
    usePublicDid?: boolean
  }) {
    const did = await this.didService.getPublicDidOrCreateNew(usePublicDid)
    const body = {
      goal,
      goalCode,
    }

    if (goalCode === OutOfBandGoalCode.AndroidNearbyHandshake) {
      if (!attachments || !attachments.length) {
        throw new AriesFrameworkError(`Attachment must be passed for 'AndroidNearbyHandshake' goal code`)
      }
      const handshakeAttachment = JsonTransformer.fromJSON(attachments[0], AndroidNearbyHandshakeAttachment)
      return new OutOfBandInvitationMessage({
        from: did.did,
        body,
        attachments: [OutOfBandInvitationMessage.createAndroidNearbyHandshakeJSONAttachment(handshakeAttachment)],
      })
    }
    if (goalCode === OutOfBandGoalCode.PaymentOffer) {
      if (!attachments || !attachments.length) {
        throw new AriesFrameworkError(`Attachment must be passed for 'OfferPayment' goal code`)
      }
      const messageAttachments = []

      const offerAttachment = JsonTransformer.fromJSON(attachments[0], PaymentOfferAttachment)
      messageAttachments.push(OutOfBandInvitationMessage.createPaymentOfferJSONAttachment(offerAttachment))

      if (attachments[1]) {
        const handshakeAttachment = JsonTransformer.fromJSON(attachments[1], AndroidNearbyHandshakeAttachment)
        messageAttachments.push(
          OutOfBandInvitationMessage.createAndroidNearbyHandshakeJSONAttachment(handshakeAttachment)
        )
      }

      return new OutOfBandInvitationMessage({
        from: did.did,
        body,
        attachments: messageAttachments,
      })
    }

    return new OutOfBandInvitationMessage({
      from: did.did,
      body,
      attachments: attachments?.map((attachment) =>
        OutOfBandInvitationMessage.createOutOfBandJSONAttachment(attachment)
      ),
    })
  }

  public async acceptOutOfBandInvitation(message: OutOfBandInvitationMessage) {
    if (message.body.goalCode === OutOfBandGoalCode.DidExchange) {
      const didInfo = await this.wellKnownService.resolve(message.from)
      if (!didInfo) {
        throw new AriesFrameworkError(`Unable to resolve info for the DID: ${message.from}`)
      }
      await this.didService.storeRemoteDid(didInfo)
    }
  }

  public async receiveOutOfBandInvitation(message: OutOfBandInvitationMessage) {
    const senderInfo = await this.wellKnownService.resolve(message.from)
    if (!senderInfo) {
      throw new AriesFrameworkError(`Unable to resolve info for the DID: ${message.from}`)
    }
    this.eventEmitter.emit<OutOfBandEvent>({
      type: OutOfBandEventTypes.OutOfBandInvitationReceived,
      payload: {
        message,
        senderInfo,
      },
    })
  }
}
