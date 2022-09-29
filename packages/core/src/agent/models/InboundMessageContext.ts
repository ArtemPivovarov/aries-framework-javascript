import type { ConnectionRecord } from '../../modules/connections'
import type { DIDCommMessage } from '../didcomm'
import type { Key } from '../../modules/dids'

import { AriesFrameworkError } from '../../error'

export interface MessageContextParams {
  connection?: ConnectionRecord
  sender?: string
  recipient?: string
  sessionId?: string
  senderKey?: Key
  recipientKey?: Key
}

export class InboundMessageContext<T extends DIDCommMessage = DIDCommMessage> {
  public message: T
  public connection?: ConnectionRecord
  public sessionId?: string
  public sender?: string
  public recipient?: string

  public constructor(message: T, context: MessageContextParams = {}) {
    this.message = message
    this.recipient = context.recipient
    this.sender = context.sender
    this.connection = context.connection
    this.sessionId = context.sessionId
  }

  /**
   * Assert the inbound record has a ready connection associated with it.
   *
   * @throws {AriesFrameworkError} if there is no connection or the connection is not ready
   */
  public assertReadyConnection(): ConnectionRecord {
    if (!this.connection) {
      throw new AriesFrameworkError(`No connection associated with incoming message ${this.message.type}`)
    }

    // Make sure connection is ready
    this.connection.assertReady()

    return this.connection
  }
}
