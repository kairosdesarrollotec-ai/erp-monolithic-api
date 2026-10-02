import { FirebaseRecipientContactLookupAdapter } from './firebase-recipient-contact-lookup.adapter';
import { getAuth } from 'firebase-admin/auth';

// moduleNameMapper redirects firebase-admin/auth and config/firebase-admin.config
// to jest.fn() stubs — no jest.mock() calls needed.

describe('FirebaseRecipientContactLookupAdapter', () => {
  let adapter: FirebaseRecipientContactLookupAdapter;
  const mockGetUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
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

    const result = await adapter.lookupContact('user-123', 'org-1');

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

    const result = await adapter.lookupContact('user-single-token', 'org-1');

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

    const result = await adapter.lookupContact('non-existent-uid', 'org-1');

    expect(result).toBeNull();
  });
});
