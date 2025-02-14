import { Expose } from 'class-transformer'
import { IsString } from 'class-validator'

import { DIDCommV1Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export class AnswerMessage extends DIDCommV1Message {
  /**
   * Create new AnswerMessage instance.
   * @param options
   */
  public constructor(options: { id?: string; response: string; threadId: string }) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.setThread({ threadId: options.threadId })
      this.response = options.response
    }
  }

  @IsValidMessageType(AnswerMessage.type)
  public readonly type = AnswerMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/questionanswer/1.0/answer')

  @Expose({ name: 'response' })
  @IsString()
  public response!: string
}
