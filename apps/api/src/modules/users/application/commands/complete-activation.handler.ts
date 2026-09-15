import { Injectable } from '@nestjs/common';
import { UserProfileRepositoryPort } from '../ports/user-profile-repository.port';
import { CompleteActivationCommand } from './complete-activation.command';

/**
 * TR-02 paso 2: se invoca luego de que el frontend confirma el enrolamiento
 * MFA TOTP contra Firebase (multiFactor(user).enroll(...)). Este endpoint
 * NO enrola el MFA (eso lo hace el SDK cliente de Firebase directamente) -
 * solo marca el perfil como activado para que TR-06 deje de redirigir aqui.
 */
@Injectable()
export class CompleteActivationHandler {
  constructor(private readonly repository: UserProfileRepositoryPort) {}

  async execute(command: CompleteActivationCommand): Promise<void> {
    await this.repository.completeActivation(command.firebaseUid);
  }
}
