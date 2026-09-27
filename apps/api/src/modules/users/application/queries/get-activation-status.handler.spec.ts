import { GetActivationStatusHandler } from './get-activation-status.handler';
import { GetActivationStatusQuery } from './get-activation-status.query';
import { UserProfileRepositoryPort } from '../ports/user-profile-repository.port';

describe('GetActivationStatusHandler', () => {
  it('requiere cambio de contrasena y MFA si el perfil recien fue creado', async () => {
    const repository: jest.Mocked<UserProfileRepositoryPort> = {
      findByFirebaseUid: jest.fn().mockResolvedValue({
        id: 'p1',
        organizationId: 'org-1',
        firebaseUid: 'uid-1',
        requiresPasswordChange: true,
        mfaEnrolledAt: null,
      }),
      createProfile: jest.fn(),
      completeActivation: jest.fn(),
    };
    const handler = new GetActivationStatusHandler(repository);

    const result = await handler.execute(new GetActivationStatusQuery('uid-1'));

    expect(result).toEqual({ requiresPasswordChange: true, requiresMfaEnrollment: true });
  });

  it('no requiere nada si el perfil ya completo activacion', async () => {
    const repository: jest.Mocked<UserProfileRepositoryPort> = {
      findByFirebaseUid: jest.fn().mockResolvedValue({
        id: 'p1',
        organizationId: 'org-1',
        firebaseUid: 'uid-1',
        requiresPasswordChange: false,
        mfaEnrolledAt: new Date('2026-01-01'),
      }),
      createProfile: jest.fn(),
      completeActivation: jest.fn(),
    };
    const handler = new GetActivationStatusHandler(repository);

    const result = await handler.execute(new GetActivationStatusQuery('uid-1'));

    expect(result).toEqual({ requiresPasswordChange: false, requiresMfaEnrollment: false });
  });

  it('asume que no requiere activacion si no existe UserProfile todavia', async () => {
    const repository: jest.Mocked<UserProfileRepositoryPort> = {
      findByFirebaseUid: jest.fn().mockResolvedValue(null),
      createProfile: jest.fn(),
      completeActivation: jest.fn(),
    };
    const handler = new GetActivationStatusHandler(repository);

    const result = await handler.execute(new GetActivationStatusQuery('uid-sin-perfil'));

    expect(result).toEqual({ requiresPasswordChange: false, requiresMfaEnrollment: false });
  });
});
