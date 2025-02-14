import type { EncryptedMessage } from '../../agent/didcomm/types'
import type { DependencyManager } from '../../plugins'
import type { MediationRecord } from './repository'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageReceiver } from '../../agent/MessageReceiver'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { injectable, module } from '../../plugins'
import { ConnectionService } from '../connections/services'

import { DidListUpdateHandler, ForwardHandler } from './handlers'
import { MediationRequestHandler } from './handlers/MediationRequestHandler'
import { MessagePickupService, V2MessagePickupService } from './protocol'
import { BatchHandler, BatchPickupHandler } from './protocol/pickup/v1/handlers'
import { MediatorService } from './services/MediatorService'

@module()
@injectable()
export class MediatorModule {
  private mediatorService: MediatorService
  private messagePickupService: MessagePickupService
  private messageSender: MessageSender
  public eventEmitter: EventEmitter
  public agentConfig: AgentConfig
  public connectionService: ConnectionService

  public constructor(
    dispatcher: Dispatcher,
    mediationService: MediatorService,
    messagePickupService: MessagePickupService,
    messageSender: MessageSender,
    messageReceiver: MessageReceiver,
    eventEmitter: EventEmitter,
    agentConfig: AgentConfig,
    connectionService: ConnectionService
  ) {
    this.mediatorService = mediationService
    this.messagePickupService = messagePickupService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.registerHandlers(dispatcher)
  }

  public async grantRequestedMediation(mediatorId: string): Promise<MediationRecord> {
    const record = await this.mediatorService.getById(mediatorId)
    const connectionRecord = await this.connectionService.getById(record.did)

    const { message, mediationRecord } = await this.mediatorService.createGrantMediationMessage(record)
    const outboundMessage = createOutboundMessage(connectionRecord, message)

    await this.messageSender.sendDIDCommV1Message(outboundMessage)

    return mediationRecord
  }

  public queueMessage(connectionId: string, message: EncryptedMessage) {
    return this.messagePickupService.queueMessage(connectionId, message)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new DidListUpdateHandler(this.mediatorService, this.messageSender))
    dispatcher.registerHandler(new ForwardHandler(this.mediatorService, this.connectionService, this.messageSender))
    dispatcher.registerHandler(new BatchPickupHandler(this.messagePickupService, this.messageSender))
    dispatcher.registerHandler(new BatchHandler(this.eventEmitter))
    dispatcher.registerHandler(new MediationRequestHandler(this.mediatorService, this.agentConfig, this.messageSender))
  }

  /**
   * Registers the dependencies of the mediator module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(MediatorModule)

    // Services
    dependencyManager.registerSingleton(MediatorService)
    dependencyManager.registerSingleton(MessagePickupService)
    dependencyManager.registerSingleton(V2MessagePickupService)

    // FIXME: Inject in constructor
    dependencyManager.resolve(V2MessagePickupService)
  }
}
