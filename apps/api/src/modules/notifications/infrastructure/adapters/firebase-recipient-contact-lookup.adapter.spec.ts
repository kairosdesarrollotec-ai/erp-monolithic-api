import { FirebaseRecipientContactLookupAdapter } from './firebase-recipient-contact-lookup.adapter';
import { getAuth } from 'firebase-admin/auth';
import { initFirebaseAdmin } from '../../../../config/firebase-admin.config';

jest.mock('firebase-admin/auth');
jest.mock('../../../../config/firebase-admin.config');

describe('FirebaseRecipientContactLookupAdapter', () => {
  let adapter: FirebaseRecipientContactLookupAdapter;
  const mockGetUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (initFirebaseAdmin as jest.Mock).mockReturnValue({});
    (getAuth as jest.Mock).mockReturnValue({
      getUser: mockGetUser,
    });
    adapter = new FirebaseRecipientContactLookupAdapter();
  });

  it('resuelve contacto completo con email, teléfono y tokens FCM (array)', async () => {
    mockGetUser.mockResolvedValueOnce({
      uid: 'user-123',
      email: 'juan@veloxrent.com',
      phoneNumber: '+51999888777',
      displayName: 'Juan Perez',
      customClaims: {
        fcmTokens: ['token-alpha', 'token-beta'],
      },
    });

    const result = await adapter.lookupContact('user-123');

    expect(result).toEqual({
      recipientId: 'user-123',
      email: 'juan@veloxrent.com',
      phoneNumber: '+51999888777',
      displayName: 'Juan Perez',
      pushTokens: ['token-alpha', 'token-beta'],
    });
  });

  it('resuelve contacto con fcmToken individual en customClaims', async () => {
    mockGetUser.mockResolvedValueOnce({
      uid: 'user-single-token',
      email: 'maria@veloxrent.com',
      phoneNumber: null,
      displayName: null,
      customClaims: {
        fcmToken: 'token-single',
      },
    });

    const result = await adapter.lookupContact('user-single-token');

    expect(result).toEqual({
      recipientId: 'user-single-token',
      email: 'maria@veloxrent.com',
      phoneNumber: null,
      displayName: null,
      pushTokens: ['token-single'],
    });
  });

  it('retorna null y no propaga error si Firebase Auth lanza excepción (ej. user not found)', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('User record not found'));

    const result = await adapter.lookupContact('non-existent-uid');

    expect(result).toBeNull();
  });
});
