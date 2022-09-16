import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ResumeValueTransferTransactionEvent } from '../ValueTransferEvents'
import type {
  WitnessTableQueryMessage,
  CashAcceptedMessage,
  CashRemovedMessage,
  RequestAcceptedMessage,
} from '../messages'
import type { MintMessage } from '../messages/MintMessage'
import type { ValueTransferRecord } from '../repository'

import {
  WitnessDetails,
  WitnessState,
  Witness,
  RequestAcceptance,
  CashRemoval,
  CashAcceptance,
} from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { DidMarker, DidService } from '../../dids'
import { WellKnownService } from '../../well-known'
import { GossipService } from '../../witness-gossip/service'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { WitnessTableMessage } from '../messages'
import { MintResponseMessage } from '../messages/MintResponseMessage'
import { ValueTransferRepository } from '../repository'
import { WitnessStateRecord } from '../repository/WitnessStateRecord'
import { WitnessStateRepository } from '../repository/WitnessStateRepository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'
import { ValueTransferTransportService } from './ValueTransferTransportService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferWitnessService {
  private config: AgentConfig
  private valueTransferRepository: ValueTransferRepository
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private witnessStateRepository: WitnessStateRepository
  private gossipService: GossipService
  private didService: DidService
  private eventEmitter: EventEmitter
  private witness: Witness
  private wellKnownService: WellKnownService

  public constructor(
    config: AgentConfig,
    valueTransferRepository: ValueTransferRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    valueTransferTransportService: ValueTransferTransportService,
    witnessStateRepository: WitnessStateRepository,
    gossipService: GossipService,
    didService: DidService,
    eventEmitter: EventEmitter,
    wellKnownService: WellKnownService
  ) {
    this.config = config
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.witnessStateRepository = witnessStateRepository
    this.didService = didService
    this.gossipService = gossipService
    this.eventEmitter = eventEmitter
    this.wellKnownService = wellKnownService

    this.eventEmitter.on(
      ValueTransferEventTypes.ResumeTransaction,
      async (event: ResumeValueTransferTransactionEvent) => {
        await this.resumeTransaction(event.payload.thid)
      }
    )

    this.witness = new Witness(
      {
        crypto: this.valueTransferCryptoService,
        storage: this.valueTransferStateService,
        transport: valueTransferTransportService,
        logger: this.config.logger,
      },
      {
        label: config.label,
        issuers: config.witnessIssuerDids,
      }
    )
  }

  public async init(): Promise<void> {
    await this.initState()
    await this.gossipService.startGossiping()
  }

  private async initState(): Promise<void> {
    this.config.logger.info('> VTP Witness state initialization started')

    const existingState = await this.witnessStateRepository.findSingleByQuery({})

    // witness has already been initialized
    if (existingState) return

    const publicDid = await this.didService.findStaticDid(DidMarker.Online)
    const gossipDid = await this.didService.findStaticDid(DidMarker.Restricted)
    if (!publicDid || !gossipDid) {
      throw new AriesFrameworkError(
        'Witness public DID not found. Please set `Online` and `Restricted` markers must be used in the agent config.'
      )
    }

    const config = this.config.valueWitnessConfig

    if (!config || !config?.knownWitnesses.length) {
      throw new AriesFrameworkError('Witness table must be provided.')
    }

    const info = new WitnessDetails({
      wid: config.wid,
      gossipDid: gossipDid.did,
      publicDid: publicDid.did,
    })

    const witnessState = new WitnessState({
      info,
      mappingTable: config.knownWitnesses,
    })

    const state = new WitnessStateRecord({
      witnessState,
    })

    await this.witnessStateRepository.save(state)

    this.config.logger.info('< VTP Witness state initialization completed!')
  }

  /**
   * Process a received {@link RequestAcceptedMessage}.
   *
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the request message.
   *
   * @returns
   *    * Value Transfer record
   *    * Witnessed Request Acceptance message
   */
  public async processRequestAcceptance(messageContext: InboundMessageContext<RequestAcceptedMessage>): Promise<{
    record?: ValueTransferRecord
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: requestAcceptanceMessage } = messageContext

    this.config.logger.info(
      `> Witness ${this.config.label}: process request acceptance message for VTP transaction ${requestAcceptanceMessage.thid}`
    )

    const requestAcceptance = new RequestAcceptance(requestAcceptanceMessage)
    const { error, transaction, message } = await this.witness.processRequestAcceptance(requestAcceptance)
    if (error || !transaction || !message) {
      throw new AriesFrameworkError(`Failed to create Payment Request: ${error?.message}`)
    }

    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(
      `< Witness ${this.config.label}: process request acceptance message for VTP transaction ${requestAcceptanceMessage.thid} completed!`
    )

    return { record }
  }

  /**
   * Process a received {@link CashAcceptedMessage}.
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   *
   * @returns
   *    * Value Transfer record
   *    * Witnessed Cash Acceptance message
   */
  public async processCashAcceptance(messageContext: InboundMessageContext<CashAcceptedMessage>): Promise<{
    record?: ValueTransferRecord
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashAcceptedMessage } = messageContext

    this.config.logger.info(
      `> Witness ${this.config.label}: process cash acceptance message for VTP transaction ${cashAcceptedMessage.thid}`
    )

    const cashAcceptance = new CashAcceptance(cashAcceptedMessage)
    const { error, transaction, message } = await this.witness.processCashAcceptance(cashAcceptance)
    if (error || !transaction || !message) {
      this.config.logger.error(
        ` Giver: process cash acceptance message for VTP transaction ${cashAcceptedMessage.thid} failed. Error: ${error}`
      )
      return {}
    }

    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(
      `< Witness ${this.config.label}: process cash acceptance message for VTP transaction ${cashAcceptedMessage.thid} completed!`
    )

    return { record }
  }

  /**
   * Process a received {@link CashRemovedMessage}.
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   *
   * @returns
   *    * Value Transfer record
   *    * Witnessed Cash Removal message
   */
  public async processCashRemoval(messageContext: InboundMessageContext<CashRemovedMessage>): Promise<{
    record?: ValueTransferRecord
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashRemovedMessage } = messageContext

    this.config.logger.info(
      `> Witness ${this.config.label}: process cash removal message for VTP transaction ${cashRemovedMessage.thid}`
    )

    const cashRemoval = new CashRemoval(cashRemovedMessage)
    const { error, transaction, getterMessage, giverMessage } = await this.witness.createReceipt(cashRemoval)
    if (error || !transaction || !getterMessage || !giverMessage) {
      this.config.logger.error(
        ` Giver: process cash removal message for VTP transaction ${cashRemovedMessage.thid} failed. Error: ${error}`
      )
      return {}
    }

    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(
      `< Witness ${this.config.label}: process cash removal message for VTP transaction ${cashRemovedMessage.thid} completed!`
    )

    return { record }
  }

  /**
   * Process a received {@link MintMessage}.
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.@returns
   *    * Value Transfer record
   *    * Witnessed Cash Removal message
   */
  public async processCashMint(messageContext: InboundMessageContext<MintMessage>): Promise<{
    message?: MintResponseMessage
  }> {
    this.config.logger.info(
      `> Witness ${this.config.label}: process cash mint request from '${messageContext.message.from}'`
    )

    const { message: mintMessage } = messageContext

    const { error, message } = await this.witness.processCashMint(mintMessage)
    if (error || !message) {
      this.config.logger.error(`  Issuer: Failed to mint cash: ${error?.message}`)
      return {}
    }

    const mintResponseMessage = new MintResponseMessage(message)

    this.config.logger.info(
      `< Witness ${this.config.label}: process cash mint request from '${messageContext.message.from}' completed!`
    )

    return { message: mintResponseMessage }
  }

  /**
   * Resume processing of VTP transaction
   * */
  public async resumeTransaction(thid: string): Promise<void> {
    this.config.logger.info(`> Witness ${this.config.label}: resume transaction '${thid}'`)

    await this.witness.resumeTransaction(thid)

    this.config.logger.info(`< Witness ${this.config.label}: transaction resumed ${thid}`)
  }

  public async processWitnessTableQuery(messageContext: InboundMessageContext<WitnessTableQueryMessage>): Promise<{
    message?: WitnessTableMessage
  }> {
    this.config.logger.info('> Witness process witness table query message')

    const { message: witnessTableQuery } = messageContext

    const { message, error } = await this.witness.processWitnessTableQuery(witnessTableQuery)
    if (error || !message) {
      this.config.logger.error(`  Witness: Failed to process table query: ${error?.message}`)
      return {}
    }

    const witnessTableMessage = new WitnessTableMessage(message)

    this.config.logger.info('> Witness process witness table query message completed!')
    return { message: witnessTableMessage }
  }
}
