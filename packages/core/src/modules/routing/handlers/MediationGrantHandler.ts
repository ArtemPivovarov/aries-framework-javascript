import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediationRecipientService } from '../services/MediationRecipientService'

import { MediationGrantMessageV2 } from '../messages'

export class MediationGrantHandler implements Handler {
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [MediationGrantMessageV2]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationGrantHandler>) {
    await this.mediationRecipientService.processMediationGrant(messageContext)
  }
}
