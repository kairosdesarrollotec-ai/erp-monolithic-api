import { ConsoleSmsNotificationAdapter } from './console-sms-notification.adapter';
import { ChannelNotificationPayload } from '../../domain/external-notification';

describe('ConsoleSmsNotificationAdapter', () => {
  let adapter: ConsoleSmsNotificationAdapter;

  const basePayload: ChannelNotificationPayload = {
    sourceEventId: 'evt-100',
    organizationId: 'org-1',
    companyId: 'comp-1',
    branchId: 'branch-1',
    eventType: 'ReservationCreated',
    recipient: {
      recipientId: 'uid-1',
      email: 'user@veloxrent.com',
      phoneNumber: '+51987654321',
      pushTokens: [],
      displayName: 'Test User',
    },
    title: 'Nueva Reserva',
    body: 'Su reserva #1234 ha sido creada con éxito.',
  };

  beforeEach(() => {
    adapter = new ConsoleSmsNotificationAdapter();
  });

  it('omite envío con SKIPPED si no hay número telefónico', async () => {
    const payloadWithoutPhone: ChannelNotificationPayload = {
      ...basePayload,
      recipient: {
        ...basePayload.recipient,
        phoneNumber: null,
      },
    };

    const result = await adapter.send(payloadWithoutPhone);

    expect(result.status).toBe('SKIPPED');
    expect(result.channel).toBe('SMS');
    expect(result.reason).toBe('PHONE_NUMBER_MISSING');
  });

  it('despacha SMS exitosamente enmascarando el teléfono por PII', async () => {
    const result = await adapter.send(basePayload);

    expect(result.status).toBe('DELIVERED');
    expect(result.channel).toBe('SMS');
    expect(result.recipientTarget).toBe('+51***4321');
    expect(result.providerMessageId).toMatch(/^sms-[0-9a-f-]+$/);
    expect(result.attemptedAt).toBeInstanceOf(Date);
  });

  it('despacha mensajes largos (> 160 caracteres) sin error', async () => {
    const longBody = 'A'.repeat(200);
    const longPayload: ChannelNotificationPayload = {
      ...basePayload,
      body: longBody,
    };

    const result = await adapter.send(longPayload);

    expect(result.status).toBe('DELIVERED');
    expect(result.channel).toBe('SMS');
  });
});
