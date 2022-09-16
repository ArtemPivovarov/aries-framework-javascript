/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ValueTransferRecord } from '@aries-framework/core'

import { DidMarker, Transports } from '@aries-framework/core'
import { TransactionState } from '@sicpa-dlab/value-transfer-protocol-ts'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class Carol extends BaseAgent {
  public valueTransferRecordId?: string

  public constructor(name: string, port?: number) {
    super({
      name,
      port,
      transports: [Transports.Nearby, Transports.HTTP, Transports.WS],
      mediatorConnectionsInvite: BaseAgent.defaultMediatorConnectionInvite,
      staticDids: [
        {
          seed: '6b8b882e2618fa5d45ee7229ca880071',
          transports: [Transports.Nearby],
          marker: DidMarker.Offline,
        },
        {
          seed: '6b8b882e2618fa5d45ee7229ca880072',
          transports: [Transports.Nearby, Transports.HTTP],
          marker: DidMarker.Online,
        },
      ],
      valueTransferConfig: {
        party: {},
      },
    })
  }

  public static async build(): Promise<Carol> {
    const getter = new Carol('carol', undefined)
    await getter.initializeAgent()
    const publicDid = await getter.agent.getStaticDid(DidMarker.Online)
    console.log(`Carol Public DID: ${publicDid?.did}`)
    return getter
  }

  private async getValueTransferRecord() {
    if (!this.valueTransferRecordId) {
      throw Error(redText(Output.MissingValueTransferRecord))
    }
    return await this.agent.valueTransfer.getById(this.valueTransferRecordId)
  }

  public async requestPayment(witness: string) {
    const { record } = await this.agent.valueTransfer.requestPayment({
      amount: 1,
      witness,
      transport: Transports.Nearby,
    })
    this.valueTransferRecordId = record.id
    console.log(greenText('\nRequest Sent!\n'))
    await this.waitForPayment()
  }

  public async acceptPaymentOffer(valueTransferRecord: ValueTransferRecord, witness: string) {
    const { record } = await this.agent.valueTransfer.acceptPaymentOffer({
      recordId: valueTransferRecord.id,
      witness,
    })
    this.valueTransferRecordId = record?.id
    console.log(greenText('\nPayment offer accepted!\n'))
    await this.waitForPayment()
  }

  public async abortPaymentOffer(valueTransferRecord: ValueTransferRecord) {
    const { record } = await this.agent.valueTransfer.abortTransaction(valueTransferRecord.id)
    this.valueTransferRecordId = record?.id
    console.log(redText('\nPayment request rejected!\n'))
    console.log(record?.error)
  }

  private async waitForPayment() {
    const valueTransferRecord = await this.getValueTransferRecord()

    console.log('Waiting for Giver to pay...')
    try {
      const record = await this.agent.valueTransfer.returnWhenIsCompleted(valueTransferRecord.id)
      if (record.state === TransactionState.Completed) {
        console.log(greenText(Output.PaymentDone))
        console.log(greenText('Receipt:'))
        console.log(record.receipt)
        const balance = await this.agent.valueTransfer.getBalance()
        console.log(greenText('Balance: ' + balance))
      }
      if (record.state === TransactionState.Failed) {
        console.log(redText('Payment Failed:'))
        console.log(record.error)
      }
    } catch (e) {
      console.log(redText(`\nTimeout of 120 seconds reached.. Returning to home screen.\n`))
      return
    }
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
