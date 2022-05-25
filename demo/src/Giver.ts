/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { Transport } from '@aries-framework/core'
import type { ValueTransferRecord } from '@aries-framework/core/src/modules/value-transfer'
import type { ValueTransferConfig } from '@aries-framework/core/src/types'

import { ValueTransferRole } from '@aries-framework/core/src/modules/value-transfer'
import { ValueTransferState } from '@aries-framework/core/src/modules/value-transfer/ValueTransferState'
import { createVerifiableNotes } from '@value-transfer/value-transfer-lib'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class Giver extends BaseAgent {
  public valueTransferRecordId?: string
  public connectionRecordWitnessId?: string
  public connected: boolean
  public static transport: Transport = 'nfc'
  public static seed = '6b8b882e2618fa5d45ee7229ca880083'

  public constructor(
    name: string,
    port?: number,
    offlineTransports?: string[],
    valueTransferConfig?: ValueTransferConfig
  ) {
    super(name, undefined, port, offlineTransports, valueTransferConfig)
    this.connected = false
  }

  public static async build(): Promise<Giver> {
    const valueTransferConfig: ValueTransferConfig = {
      role: ValueTransferRole.Giver,
      verifiableNotes: createVerifiableNotes(10),
    }
    const giver = new Giver('giver', undefined, [Giver.transport], valueTransferConfig)
    await giver.initializeAgent()
    return giver
  }

  private async getValueTransferRecord() {
    if (!this.valueTransferRecordId) {
      throw Error(redText(Output.MissingValueTransferRecord))
    }
    return await this.agent.valueTransfer.getById(this.valueTransferRecordId)
  }

  private async sendOutOfBandInvite() {
    const invite = await this.agent.connections.createOutOfBandConnection({
      transport: Giver.transport,
      goalCode: 'pay.cash.vtp',
    })
    this.connectionRecordWitnessId = invite.connectionRecord.id

    await this.outBoundTransport.sendMessage({
      payload: { ...invite.invitation },
    })
    console.log(Output.ConnectionInvitationSent, invite.invitation, '\n')
    console.log(greenText('DID: ' + invite.connectionRecord.did))
    return invite.connectionRecord
  }

  private async waitForPayment() {
    const valueTransferRecord = await this.getValueTransferRecord()

    console.log('Waiting for finishing payment...')
    try {
      const record = await this.agent.valueTransfer.returnWhenIsCompleted(valueTransferRecord.id)
      if (record.state === ValueTransferState.Completed) {
        console.log(greenText(Output.PaymentDone))
        console.log(greenText('Receipt:'))
        console.log(record.giverReceiptMessage)
        const balance = await this.agent.valueTransfer.getBalance()
        console.log(greenText('Balance: ' + balance))
      }
      if (record.state === ValueTransferState.Failed) {
        console.log(redText('Payment Failed:'))
        console.log(record.problemReportMessage)
      }
    } catch (e) {
      console.log(redText(`\nTimeout of 120 seconds reached.. Returning to home screen.\n`))
      return
    }
  }

  public async setupConnection() {
    await this.sendOutOfBandInvite()
  }

  public async acceptPaymentRequest(valueTransferRecord: ValueTransferRecord) {
    const { record } = await this.agent.valueTransfer.acceptPaymentRequest(valueTransferRecord.id)
    this.valueTransferRecordId = record.id
    console.log(greenText('\nPayment request accepted!\n'))
    await this.waitForPayment()
  }

  public async exit() {
    console.log(Output.Exit)
    await this.agent.shutdown()
    process.exit(0)
  }

  public async restart() {
    await this.agent.shutdown()
  }
}
