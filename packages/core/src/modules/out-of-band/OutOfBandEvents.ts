import type { BaseEvent } from '../../agent/Events'
import type { DIDInformation } from '../dids/domain'
import type { OutOfBandInvitationMessage } from './messages'

export enum OutOfBandEventTypes {
  OutOfBandInvitationReceived = 'OutOfBandInvitationReceived',
}
export interface OutOfBandEvent extends BaseEvent {
  type: typeof OutOfBandEventTypes.OutOfBandInvitationReceived
  payload: {
    message: OutOfBandInvitationMessage
    senderInfo: DIDInformation
  }
}
