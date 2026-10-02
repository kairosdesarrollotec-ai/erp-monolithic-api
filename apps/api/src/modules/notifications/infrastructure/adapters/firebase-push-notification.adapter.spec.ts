import { FirebasePushNotificationAdapter } from './firebase-push-notification.adapter';
import { getMessaging } from 'firebase-admin/messaging';
import { ChannelNotificationPayload } from '../../domain/external-notification';

// moduleNameMapper redirects firebase-admin/messaging and config/firebase-admin.config
// to jest.fn() stubs — no jest.mock() calls needed.

describe('FirebasePushNotificationAdapter', () => {
  let adapter: FirebasePushNotificationAdapter;
  const mockSendEachForMulticast = jest.fn();

  const basePayload: ChannelNotificationPayload = {
    sourceEventId: 'evt-100',
    organizationId: 'org-1',
    companyId: 'comp-1',
    branchId: 'branch-1',
    eventType: 'ReservationCreated',
    recipient: {
      recipientId: 'uid-1',
      email: 'user@test.com',
      phoneNumber: '+51987654321',
      pushTokens: ['fcm-tok-1234567890'],
      displayName: 'Test User',
    },
    title: 'Reserva Confirmada',
    body: 'Su reserva #1234 está confirmada',
    deepLink: '/reservations/1234',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getMessaging as jest.Mock).mockReturnValue({
      sendEachForMulticast: mockSendEachForMulticast,
    });
    adapter = new FirebasePushNotificationAdapter();
  });

  it('omite el envío con SKIPPED si el destinatario no tiene tokens FCM', async () => {
    const payloadWithoutTokens: ChannelNotificationPayload = {
      ...basePayload,
      recipient: {
        ...basePayload.recipient,
        pushTokens: [],
      },
    };

    const result = await adapter.send(payloadWithoutTokens);

    expect(result.status).toBe('SKIPPED');
    expect(result.channel).toBe('PUSH');
    expect(result.reason).toBe('NO_PUSH_TOKENS');
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });

  it('despacha multicast y retorna DELIVERED con token enmascarado cuando el envío tiene éxito', async () => {
    mockSendEachForMulticast.mockResolvedValueOnce({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true, messageId: 'projects/p/messages/msg-1' }],
    });

    const result = await adapter.send(basePayload);

    expect(result.status).toBe('DELIVERED');
    expect(result.channel).toBe('PUSH');
    expect(result.recipientTarget).toBe('fcm-...7890');
    expect(result.providerMessageId).toBe('projects/p/messages/msg-1');
    expect(mockSendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['fcm-tok-1234567890'],
      notification: {
        title: 'Reserva Confirmada',
        body: 'Su reserva #1234 está confirmada',
      },
      data: {
        sourceEventId: 'evt-100',
        deepLink: '/reservations/1234',
        eventType: 'ReservationCreated',
      },
    });
  });

  it('retorna FAILED si todos los tokens del lote fallan', async () => {
    mockSendEachForMulticast.mockResolvedValueOnce({
      successCount: 0,
      failureCount: 1,
      responses: [{ success: false, error: new Error('Token unregistered') }],
    });

    const result = await adapter.send(basePayload);

    expect(result.status).toBe('FAILED');
    expect(result.channel).toBe('PUSH');
    expect(result.reason).toContain('1 tokens failed out of 1');
  });

  it('captura excepciones críticas de FCM retornando FAILED sin lanzar error', async () => {
    mockSendEachForMulticast.mockRejectedValueOnce(
      new Error('Google Cloud Messaging quota exceeded'),
    );

    const result = await adapter.send(basePayload);

    expect(result.status).toBe('FAILED');
    expect(result.channel).toBe('PUSH');
    expect(result.error?.code).toBe('FCM_ERROR');
    expect(result.error?.message).toContain('quota exceeded');
  });
});
