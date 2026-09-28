import { NotificationDispatcherService } from './notification-dispatcher.service';
import { RecipientContactLookupPort } from '../ports/recipient-contact-lookup.port';
import {
  EmailNotificationPort,
  PushNotificationPort,
  SmsNotificationPort,
} from '../ports/channel-notification.port';
import { DispatchNotificationInput } from '../ports/notification-dispatcher.port';

describe('NotificationDispatcherService', () => {
  let contactLookup: jest.Mocked<RecipientContactLookupPort>;
  let emailSender: jest.Mocked<EmailNotificationPort>;
  let pushSender: jest.Mocked<PushNotificationPort>;
  let smsSender: jest.Mocked<SmsNotificationPort>;
  let service: NotificationDispatcherService;

  const baseInput: DispatchNotificationInput = {
    sourceEventId: 'event-100',
    eventType: 'ReservationCreated',
    organizationId: 'org-1',
    companyId: 'comp-1',
    branchId: 'branch-1',
    recipientFirebaseUid: 'uid-12345',
    title: 'Nueva reserva confirmada',
    body: 'Se ha creado la reserva #12345',
    deepLink: '/reservations/12345',
    channels: ['EMAIL', 'PUSH', 'SMS'],
  };

  beforeEach(() => {
    contactLookup = {
      lookupContact: jest.fn().mockResolvedValue({
        recipientId: 'uid-12345',
        email: 'cliente@ejemplo.com',
        phoneNumber: '+51987654321',
        pushTokens: ['fcm-token-1'],
        displayName: 'Juan Perez',
      }),
    };

    emailSender = {
      send: jest.fn().mockResolvedValue({
        channel: 'EMAIL',
        status: 'DELIVERED',
        recipientTarget: 'c***e@ejemplo.com',
        providerMessageId: 'email-uuid-1',
        attemptedAt: new Date(),
      }),
    };

    pushSender = {
      send: jest.fn().mockResolvedValue({
        channel: 'PUSH',
        status: 'DELIVERED',
        recipientTarget: 'fcm-...ken-1',
        providerMessageId: 'fcm-batch-1',
        attemptedAt: new Date(),
      }),
    };

    smsSender = {
      send: jest.fn().mockResolvedValue({
        channel: 'SMS',
        status: 'DELIVERED',
        recipientTarget: '+51***4321',
        providerMessageId: 'sms-uuid-1',
        attemptedAt: new Date(),
      }),
    };

    service = new NotificationDispatcherService(
      contactLookup,
      emailSender,
      pushSender,
      smsSender,
    );
  });

  it('retorna ALL_SKIPPED de inmediato si la lista de canales está vacía', async () => {
    const result = await service.dispatch({ ...baseInput, channels: [] });

    expect(result.overallStatus).toBe('ALL_SKIPPED');
    expect(result.deliveries).toHaveLength(0);
    expect(contactLookup.lookupContact).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it('despacha a todos los canales configurados en paralelo cuando los contactos existen', async () => {
    const result = await service.dispatch(baseInput);

    expect(contactLookup.lookupContact).toHaveBeenCalledWith('uid-12345');
    expect(emailSender.send).toHaveBeenCalledTimes(1);
    expect(pushSender.send).toHaveBeenCalledTimes(1);
    expect(smsSender.send).toHaveBeenCalledTimes(1);

    expect(result.overallStatus).toBe('ALL_DELIVERED');
    expect(result.deliveries).toHaveLength(3);
  });

  it('omite EMAIL si el usuario no tiene email configurado', async () => {
    contactLookup.lookupContact.mockResolvedValueOnce({
      recipientId: 'uid-12345',
      email: null,
      phoneNumber: '+51987654321',
      pushTokens: ['fcm-token-1'],
      displayName: null,
    });

    const result = await service.dispatch(baseInput);

    expect(emailSender.send).not.toHaveBeenCalled();
    expect(pushSender.send).toHaveBeenCalledTimes(1);
    expect(smsSender.send).toHaveBeenCalledTimes(1);

    const emailDelivery = result.deliveries.find((d) => d.channel === 'EMAIL');
    expect(emailDelivery?.status).toBe('SKIPPED');
    expect(emailDelivery?.reason).toBe('RECIPIENT_EMAIL_NOT_CONFIGURED');
    expect(result.overallStatus).toBe('PARTIALLY_DELIVERED');
  });

  it('omite PUSH si el usuario no tiene tokens registrados', async () => {
    contactLookup.lookupContact.mockResolvedValueOnce({
      recipientId: 'uid-12345',
      email: 'user@corp.com',
      phoneNumber: '+51987654321',
      pushTokens: [],
      displayName: null,
    });

    const result = await service.dispatch({ ...baseInput, channels: ['PUSH'] });

    expect(pushSender.send).not.toHaveBeenCalled();
    expect(result.overallStatus).toBe('ALL_SKIPPED');
    expect(result.deliveries[0].reason).toBe(
      'RECIPIENT_PUSH_TOKEN_NOT_CONFIGURED',
    );
  });

  it('omite SMS si el usuario no tiene teléfono registrado', async () => {
    contactLookup.lookupContact.mockResolvedValueOnce({
      recipientId: 'uid-12345',
      email: 'user@corp.com',
      phoneNumber: null,
      pushTokens: ['tok'],
      displayName: null,
    });

    const result = await service.dispatch({ ...baseInput, channels: ['SMS'] });

    expect(smsSender.send).not.toHaveBeenCalled();
    expect(result.overallStatus).toBe('ALL_SKIPPED');
    expect(result.deliveries[0].reason).toBe('RECIPIENT_PHONE_NOT_CONFIGURED');
  });

  it('contiene excepciones por canal para que no afecten a otros canales', async () => {
    emailSender.send.mockRejectedValueOnce(
      new Error('Fallo crítico en gateway SMTP'),
    );

    const result = await service.dispatch(baseInput);

    expect(pushSender.send).toHaveBeenCalledTimes(1);
    expect(smsSender.send).toHaveBeenCalledTimes(1);

    const emailDelivery = result.deliveries.find((d) => d.channel === 'EMAIL');
    expect(emailDelivery?.status).toBe('FAILED');
    expect(emailDelivery?.error?.code).toBe('CHANNEL_EXCEPTION');
    expect(emailDelivery?.error?.message).toContain('SMTP');

    expect(result.overallStatus).toBe('PARTIALLY_DELIVERED');
  });

  it('degrada con elegancia si la resolución de contacto lanza una excepción', async () => {
    contactLookup.lookupContact.mockRejectedValueOnce(
      new Error('Firebase service unavailable'),
    );

    const result = await service.dispatch(baseInput);

    expect(result.overallStatus).toBe('ALL_SKIPPED');
    expect(emailSender.send).not.toHaveBeenCalled();
    expect(pushSender.send).not.toHaveBeenCalled();
    expect(smsSender.send).not.toHaveBeenCalled();
  });
});
