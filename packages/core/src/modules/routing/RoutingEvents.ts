import type { BaseEvent } from '../../agent/Events'
import type { DidListUpdate } from './messages'
import type { Routing } from '../connections'
import type { KeylistUpdate } from './messages/KeylistUpdateMessage'
import type { MediationState } from './models/MediationState'
import type { MediationRecord } from './repository/MediationRecord'

export enum RoutingEventTypes {
  MediationStateChanged = 'MediationStateChanged',
  RecipientKeylistUpdated = 'RecipientKeylistUpdated',
  RoutingCreatedEvent = 'RoutingCreatedEvent',
}

export interface RoutingCreatedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.RoutingCreatedEvent
  payload: {
    routing: Routing
  }
  RecipientDidListUpdated = 'RecipientDidListUpdated',
}

export interface MediationStateChangedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.MediationStateChanged
  payload: {
    mediationRecord: MediationRecord
    previousState: MediationState | null
  }
}

export interface KeylistUpdatedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.RecipientKeylistUpdated
  payload: {
    mediationRecord: MediationRecord
    keylist: KeylistUpdate[]
  }
}

export interface DidListUpdatedEvent extends BaseEvent {
  type: typeof RoutingEventTypes.RecipientDidListUpdated
  payload: {
    mediationRecord: MediationRecord
    didList: DidListUpdate[]
  }
}
