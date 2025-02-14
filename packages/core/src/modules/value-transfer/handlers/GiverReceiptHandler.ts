import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { GiverReceiptMessage } from '../messages'

export class GiverReceiptHandler implements Handler {
  private valueTransferGiverService: ValueTransferGiverService
  public readonly supportedMessages = [GiverReceiptMessage]

  public constructor(valueTransferGiverService: ValueTransferGiverService) {
    this.valueTransferGiverService = valueTransferGiverService
  }

  public async handle(messageContext: HandlerInboundMessage<GiverReceiptHandler>) {
    await this.valueTransferGiverService.processReceipt(messageContext)
  }
}
