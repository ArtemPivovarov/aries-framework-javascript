import { DIDCommV1Message } from '../../agent/didcomm/v1/DIDCommV1Message'
import {
  canHandleMessageType,
  parseMessageType,
  replaceLegacyDidSovPrefix,
  replaceLegacyDidSovPrefixOnMessage,
  replaceNewDidCommPrefixWithLegacyDidSov,
  replaceNewDidCommPrefixWithLegacyDidSovOnMessage,
  supportsIncomingMessageType,
} from '../messageType'

export class TestMessage extends DIDCommV1Message {
  public constructor() {
    super()

    this.id = this.generateId()
  }

  public readonly type = TestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/fake-protocol/1.5/invitation')
}

describe('messageType', () => {
  describe('replaceLegacyDidSovPrefixOnMessage()', () => {
    it('should replace the message type prefix with https://didcomm.org if it starts with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec', () => {
      const message = {
        '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message',
      }

      replaceLegacyDidSovPrefixOnMessage(message)

      expect(message['@type']).toBe('https://didcomm.org/basicmessage/1.0/message')
    })

    it("should not replace the message type prefix with https://didcomm.org if it doesn't start with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec", () => {
      const messageOtherDidSov = {
        '@type': 'did:sov:another_did;spec/basicmessage/1.0/message',
      }
      replaceLegacyDidSovPrefixOnMessage(messageOtherDidSov)
      expect(messageOtherDidSov['@type']).toBe('did:sov:another_did;spec/basicmessage/1.0/message')

      const messageDidComm = {
        '@type': 'https://didcomm.org/basicmessage/1.0/message',
      }
      replaceLegacyDidSovPrefixOnMessage(messageDidComm)
      expect(messageDidComm['@type']).toBe('https://didcomm.org/basicmessage/1.0/message')
    })
  })

  describe('replaceLegacyDidSovPrefix()', () => {
    it('should replace the message type prefix with https://didcomm.org if it starts with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec', () => {
      const type = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message'

      expect(replaceLegacyDidSovPrefix(type)).toBe('https://didcomm.org/basicmessage/1.0/message')
    })

    it("should not replace the message type prefix with https://didcomm.org if it doesn't start with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec", () => {
      const messageTypeOtherDidSov = 'did:sov:another_did;spec/basicmessage/1.0/message'

      expect(replaceLegacyDidSovPrefix(messageTypeOtherDidSov)).toBe(
        'did:sov:another_did;spec/basicmessage/1.0/message'
      )

      const messageTypeDidComm = 'https://didcomm.org/basicmessage/1.0/message'

      expect(replaceLegacyDidSovPrefix(messageTypeDidComm)).toBe('https://didcomm.org/basicmessage/1.0/message')
    })
  })

  describe('replaceNewDidCommPrefixWithLegacyDidSovOnMessage()', () => {
    it('should replace the message type prefix with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec if it starts with https://didcomm.org', () => {
      const message = {
        '@type': 'https://didcomm.org/basicmessage/1.0/message',
      }

      replaceNewDidCommPrefixWithLegacyDidSovOnMessage(message)

      expect(message['@type']).toBe('did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message')
    })
  })

  describe('replaceNewDidCommPrefixWithLegacyDidSov()', () => {
    it('should replace the message type prefix with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec if it starts with https://didcomm.org', () => {
      const type = 'https://didcomm.org/basicmessage/1.0/message'

      expect(replaceNewDidCommPrefixWithLegacyDidSov(type)).toBe(
        'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message'
      )
    })

    it("should not replace the message type prefix with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec if it doesn't start with https://didcomm.org", () => {
      const messageTypeOtherDidSov = 'did:sov:another_did;spec/basicmessage/1.0/message'

      expect(replaceNewDidCommPrefixWithLegacyDidSov(messageTypeOtherDidSov)).toBe(
        'did:sov:another_did;spec/basicmessage/1.0/message'
      )
    })
  })

  describe('parseMessageType()', () => {
    test('correctly parses the message type', () => {
      expect(parseMessageType('https://didcomm.org/connections/1.0/request')).toEqual({
        documentUri: 'https://didcomm.org',
        protocolName: 'connections',
        protocolVersion: '1.0',
        protocolMajorVersion: 1,
        protocolMinorVersion: 0,
        messageName: 'request',
        protocolUri: `https://didcomm.org/connections/1.0`,
        messageTypeUri: 'https://didcomm.org/connections/1.0/request',
      })

      expect(parseMessageType('https://didcomm.org/issue-credential/4.5/propose-credential')).toEqual({
        documentUri: 'https://didcomm.org',
        protocolName: 'issue-credential',
        protocolVersion: '4.5',
        protocolMajorVersion: 4,
        protocolMinorVersion: 5,
        messageName: 'propose-credential',
        protocolUri: `https://didcomm.org/issue-credential/4.5`,
        messageTypeUri: 'https://didcomm.org/issue-credential/4.5/propose-credential',
      })
    })
  })

  describe('supportsIncomingMessageType()', () => {
    test('returns true when the document uri, protocol name, major version all match and the minor version is lower than the expected minor version', () => {
      const incomingMessageType = parseMessageType('https://didcomm.org/connections/1.0/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(true)
    })

    test('returns true when the document uri, protocol name, major version all match and the minor version is higher than the expected minor version', () => {
      const incomingMessageType = parseMessageType('https://didcomm.org/connections/1.8/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(true)
    })

    test('returns true when the document uri, protocol name, major version and minor version all match', () => {
      const incomingMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(true)
    })

    test('returns true when the protocol name, major version and minor version all match and the incoming message type is using the legacy did sov prefix', () => {
      const incomingMessageType = parseMessageType('did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.4/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(true)
    })

    test('returns false when the protocol name, major version and minor version all match and the incoming message type is using the legacy did sov prefix but allowLegacyDidSovPrefixMismatch is set to false', () => {
      const incomingMessageType = parseMessageType('did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.4/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(
        supportsIncomingMessageType(expectedMessageType, incomingMessageType, {
          allowLegacyDidSovPrefixMismatch: false,
        })
      ).toBe(false)
    })

    test('returns false when the major version does not match', () => {
      const incomingMessageType = parseMessageType('https://didcomm.org/connections/2.4/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(false)

      const incomingMessageType2 = parseMessageType('https://didcomm.org/connections/2.0/request')
      const expectedMessageType2 = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType2, expectedMessageType2)).toBe(false)
    })

    test('returns false when the message name does not match', () => {
      const incomingMessageType = parseMessageType('https://didcomm.org/connections/1.4/proposal')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(false)
    })

    test('returns false when the protocol name does not match', () => {
      const incomingMessageType = parseMessageType('https://didcomm.org/issue-credential/1.4/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(false)
    })

    test('returns false when the document uri does not match', () => {
      const incomingMessageType = parseMessageType('https://my-protocol.org/connections/1.4/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(false)
    })
  })

  describe('canHandleMessageType()', () => {
    test('returns true when the document uri, protocol name, major version all match and the minor version is lower than the expected minor version', () => {
      expect(
        canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/fake-protocol/1.0/invitation'))
      ).toBe(true)
    })

    test('returns true when the document uri, protocol name, major version all match and the minor version is higher than the expected minor version', () => {
      expect(
        canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/fake-protocol/1.8/invitation'))
      ).toBe(true)
    })

    test('returns true when the document uri, protocol name, major version and minor version all match', () => {
      expect(
        canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/fake-protocol/1.5/invitation'))
      ).toBe(true)
    })

    test('returns false when the major version does not match', () => {
      expect(
        canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/fake-protocol/2.5/invitation'))
      ).toBe(false)

      expect(
        canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/fake-protocol/2.0/invitation'))
      ).toBe(false)
    })

    test('returns false when the message name does not match', () => {
      expect(canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/fake-protocol/1.5/request'))).toBe(
        false
      )
    })

    test('returns false when the protocol name does not match', () => {
      expect(
        canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/another-fake-protocol/1.5/invitation'))
      ).toBe(false)
    })

    test('returns false when the document uri does not match', () => {
      expect(
        canHandleMessageType(
          TestMessage,
          parseMessageType('https://another-didcomm-site.org/fake-protocol/1.5/invitation')
        )
      ).toBe(false)
    })
  })
})
