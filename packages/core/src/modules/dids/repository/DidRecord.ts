import type { TagsBase, RecordTags } from '../../../storage/BaseRecord'
import type { DidConnectivity } from '../domain'
import type { TagsBase } from '../../../storage/BaseRecord'
import type { DidRecordMetadata } from './didRecordMetadataTypes'

import { Type } from 'class-transformer'
import { IsBoolean, IsEnum, IsOptional, ValidateNested } from 'class-validator'

import { BaseRecord } from '../../../storage/BaseRecord'
import { DidDocument, DidMarker, DidType } from '../domain'
import { DidDocumentRole } from '../domain/DidDocumentRole'
import { parseDid } from '../domain/parse'

import { DidRecordMetadataKeys } from './didRecordMetadataTypes'

export interface DidRecordProps {
  id: string
  role: DidDocumentRole
  didDocument?: DidDocument
  isStatic?: boolean
  label?: string
  logoUrl?: string
  didType: DidType
  marker?: DidMarker
  createdAt?: Date
  tags?: CustomDidTags
}

interface CustomDidTags extends TagsBase {
  recipientKeyFingerprints?: string[]
}

type DefaultDidTags = {
  role: DidDocumentRole
  isStatic: boolean
  method: string
  legacyUnqualifiedDid?: string
  didType: DidType
  marker?: DidMarker
}

export type DidTags = RecordTags<DidRecord>

export class DidRecord extends BaseRecord<DefaultDidTags, CustomDidTags, DidRecordMetadata> implements DidRecordProps {
  @Type(() => DidDocument)
  @ValidateNested()
  public didDocument?: DidDocument

  @IsEnum(DidDocumentRole)
  public role!: DidDocumentRole

  @IsEnum(DidType)
  public didType!: DidType

  @IsOptional()
  public label?: string

  @IsOptional()
  public logoUrl?: string

  @IsBoolean()
  public isStatic!: boolean

  @IsEnum(DidMarker)
  public marker?: DidMarker

  public static readonly type = 'DidRecord'
  public readonly type = DidRecord.type

  public constructor(props: DidRecordProps) {
    super()

    if (props) {
      this.id = props.id
      this.role = props.role
      this.didDocument = props.didDocument
      this.label = props.label
      this.logoUrl = props.logoUrl
      this.didType = props.didType
      this.isStatic = props.isStatic || false
      this.marker = props.marker
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}
    }
  }

  public get did() {
    return this.id
  }

  public get connectivity(): DidConnectivity | undefined {
    return this.didDocument?.connectivity
  }

  public getTags() {
    const did = parseDid(this.id)

    const legacyDid = this.metadata.get(DidRecordMetadataKeys.LegacyDid)

    return {
      ...this._tags,
      role: this.role,
      isStatic: this.isStatic,
      method: did.method,
      legacyUnqualifiedDid: legacyDid?.unqualifiedDid,
      didType: this.didType,
      marker: this.marker,
    }
  }
}
