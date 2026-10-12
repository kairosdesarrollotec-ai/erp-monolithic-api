import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RegisterTrainingCommand } from '../../application/commands/register-training.command';
import { RegisterTrainingHandler } from '../../application/commands/register-training.handler';
import { ListTrainingsQuery } from '../../application/queries/list-trainings.query';
import { ListTrainingsHandler } from '../../application/queries/list-trainings.handler';
import { RegisterTrainingDto } from './dto/register-training.dto';
import { ListTrainingsQueryDto } from './dto/list-trainings-query.dto';
import { parseDateOnly } from './dto/hr-date';
import type { TrainingResponse } from './dto/hr-administration.response';
import { toTrainingResponse } from './hr-administration.mapper';

/** ADP-10 / BR-ADP-008: capacitación interna informal (talleres de ~1 h). */
@Controller('trainings')
@UseGuards(FirebaseAuthGuard)
export class TrainingsController {
  constructor(
    private readonly registerTraining: RegisterTrainingHandler,
    private readonly listTrainings: ListTrainingsHandler,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async register(@Req() req: AuthenticatedRequest, @Body() dto: RegisterTrainingDto): Promise<TrainingResponse> {
    const created = await this.registerTraining.execute(
      new RegisterTrainingCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.topic,
        parseDateOnly(dto.heldOn),
        dto.attendeeIds,
        dto.durationMinutes,
        dto.comprehensionNotes,
      ),
    );
    return toTrainingResponse(created);
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query() query: ListTrainingsQueryDto): Promise<TrainingResponse[]> {
    const items = await this.listTrainings.execute(
      new ListTrainingsQuery(req.firebaseUid!, query.companyId, query.branchId, query.limit),
    );
    return items.map(toTrainingResponse);
  }
}
