import { ConsoleEmailNotificationAdapter } from './console-email-notification.adapter';
import { ChannelNotificationPayload } from '../../domain/external-notification';

describe('ConsoleEmailNotificationAdapter', () => {
  let adapter: ConsoleEmailNotificationAdapter;

  const basePayload: ChannelNotificationPayload = {
    sourceEventId: 'evt-100',
    organizationId: 'org-1',
    companyId: 'comp-1',
    branchId: 'branch-1',
    eventType: 'ReservationCreated',
    recipient: {
      recipientId: 'uid-1',
      email: 'gerente.operaciones@veloxrent.com',
      phoneNumber: '+51987654321',
      pushTokens: [],
      displayName: 'Gerente Operaciones',
    },
    title: 'Nueva Reserva Registrada',
    body: 'Se ha creado la reserva #999 en sucursal central.',
  };

  beforeEach(() => {
    adapter = new ConsoleEmailNotificationAdapter();
  });

  it('omite envío con SKIPPED si no hay dirección de correo', async () => {
    const payloadWithoutEmail: ChannelNotificationPayload = {
      ...basePayload,
      recipient: {
        ...basePayload.recipient,
        email: null,
      },
    };

    const result = await adapter.send(payloadWithoutEmail);

    expect(result.status).toBe('SKIPPED');
    expect(result.channel).toBe('EMAIL');
    expect(result.reason).toBe('EMAIL_ADDRESS_MISSING');
  });

  it('despacha exitosamente enmascarando la dirección de correo por PII', async () => {
    const result = await adapter.send(basePayload);

    expect(result.status).toBe('DELIVERED');
    expect(result.channel).toBe('EMAIL');
    expect(result.recipientTarget).toBe('g***s@veloxrent.com');
    expect(result.providerMessageId).toMatch(/^email-[0-9a-f-]+$/);
    expect(result.attemptedAt).toBeInstanceOf(Date);
  });
});
