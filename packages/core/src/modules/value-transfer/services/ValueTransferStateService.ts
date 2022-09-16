import type { ValueTransferStateRecord } from '../repository/ValueTransferStateRecord'
import type {
  PartyState,
  PartyStorageInterface,
  WitnessState,
  Transaction,
} from '@sicpa-dlab/value-transfer-protocol-ts'

import AsyncLock from 'async-lock'
import { Lifecycle, scoped } from 'tsyringe'

import { ValueTransferRecord, ValueTransferRepository, WitnessStateRecord } from '../repository'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'
import { WitnessStateRepository } from '../repository/WitnessStateRepository'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferStateService implements PartyStorageInterface {
  private valueTransferRepository: ValueTransferRepository
  private valueTransferStateRepository: ValueTransferStateRepository
  private witnessStateRepository: WitnessStateRepository
  private valueTransferStateRecord?: ValueTransferStateRecord
  private witnessStateLock: AsyncLock

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferStateRepository: ValueTransferStateRepository,
    witnessStateRepository: WitnessStateRepository
  ) {
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferStateRepository = valueTransferStateRepository
    this.witnessStateRepository = witnessStateRepository
    this.witnessStateLock = new AsyncLock()
  }

  public async getPartyStateRecord(): Promise<ValueTransferStateRecord> {
    if (!this.valueTransferStateRecord) {
      this.valueTransferStateRecord = await this.valueTransferStateRepository.getSingleByQuery({})
    }
    return this.valueTransferStateRecord
  }

  public async getPartyState(): Promise<PartyState> {
    if (!this.valueTransferStateRecord) {
      this.valueTransferStateRecord = await this.valueTransferStateRepository.getSingleByQuery({})
    }
    return this.valueTransferStateRecord.partyState
  }

  public async storePartyState(partyState: PartyState): Promise<void> {
    const record = await this.valueTransferStateRepository.getSingleByQuery({})
    record.partyState = partyState
    await this.valueTransferStateRepository.update(record)
    this.valueTransferStateRecord = record
  }

  public async getWitnessStateRecord(): Promise<WitnessStateRecord> {
    return await this.witnessStateRepository.getSingleByQuery({})
  }

  public async getWitnessState(): Promise<WitnessState> {
    const record = await this.witnessStateRepository.getSingleByQuery({})
    return record.witnessState
  }

  public async storeWitnessState(witnessState: WitnessState): Promise<void> {
    const record = await this.witnessStateRepository.getSingleByQuery({})
    record.witnessState = witnessState
    await this.witnessStateRepository.update(record)
    // this.witnessStateRecord = record
  }

  /** @inheritDoc {StorageService#safeMutation} */
  public async safeOperationWithWitnessState<T>(operation: () => Promise<T>): Promise<T> {
    return this.witnessStateLock.acquire(
      WitnessStateRecord.id,
      async () => {
        return operation()
      },
      { maxOccupationTime: 60 * 1000 }
    )
  }

  public async addTransaction(transaction: Transaction): Promise<void> {
    const record = new ValueTransferRecord({
      id: transaction.id,
      transaction,
    })
    return this.valueTransferRepository.save(record)
  }

  public async deleteTransaction(id: string): Promise<void> {
    const record = await this.valueTransferRepository.getById(id)
    await this.valueTransferRepository.delete(record)
  }

  public async findTransaction(id: string): Promise<Transaction | undefined> {
    const record = await this.valueTransferRepository.findById(id)
    return record?.transaction
  }

  public async getTransaction(id: string): Promise<Transaction> {
    const record = await this.valueTransferRepository.getById(id)
    return record?.transaction
  }

  public async updateTransaction(transaction: Transaction): Promise<void> {
    const record = await this.valueTransferRepository.getById(transaction.id)
    record.transaction = transaction
    await this.valueTransferRepository.update(record)
  }
}
