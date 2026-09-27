import { CompleteActivationHandler } from './complete-activation.handler';
import { CompleteActivationCommand } from './complete-activation.command';
import { UserProfileRepositoryPort } from '../ports/user-profile-repository.port';

describe('CompleteActivationHandler', () => {
  it('delega en el repositorio marcar la activacion como completa', async () => {
    const repository: jest.Mocked<UserProfileRepositoryPort> = {
      findByFirebaseUid: jest.fn(),
      createProfile: jest.fn(),
      completeActivation: jest.fn().mockResolvedValue(undefined),
    };
    const handler = new CompleteActivationHandler(repository);

    await handler.execute(new CompleteActivationCommand('uid-1'));

    expect(repository.completeActivation).toHaveBeenCalledWith('uid-1');
  });
});
