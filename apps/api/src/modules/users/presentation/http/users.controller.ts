import { Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { GetActivationStatusHandler } from '../../application/queries/get-activation-status.handler';
import { GetActivationStatusQuery } from '../../application/queries/get-activation-status.query';
import { CompleteActivationHandler } from '../../application/commands/complete-activation.handler';
import { CompleteActivationCommand } from '../../application/commands/complete-activation.command';
import {
  AuthenticatedRequest,
  FirebaseAuthGuard,
} from '../../infrastructure/auth/firebase-auth.guard';
import { ActivationStatusResponse } from './dto/activation-status.response';

@Controller('users/me')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(
    private readonly getActivationStatus: GetActivationStatusHandler,
    private readonly completeActivation: CompleteActivationHandler,
  ) {}

  @Get('activation-status')
  async activationStatus(@Req() req: AuthenticatedRequest): Promise<ActivationStatusResponse> {
    return this.getActivationStatus.execute(new GetActivationStatusQuery(req.firebaseUid!));
  }

  @Post('complete-activation')
  @HttpCode(204)
  async completeActivationEndpoint(@Req() req: AuthenticatedRequest): Promise<void> {
    await this.completeActivation.execute(new CompleteActivationCommand(req.firebaseUid!));
  }
}
