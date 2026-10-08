import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { RecordInterviewResultHandler } from '../../application/commands/record-interview-result.handler';
import { RecordInterviewResultCommand } from '../../application/commands/record-interview-result.command';
import { RecordInterviewResultDto } from './dto/record-interview-result.dto';
import { CandidateInterviewResponse } from './dto/recruitment.response';
import { toCandidateInterviewResponse } from './recruitment.mapper';

@Controller('interviews')
@UseGuards(FirebaseAuthGuard)
export class InterviewsController {
  constructor(private readonly recordInterviewResult: RecordInterviewResultHandler) {}

  @Post(':id/commands/record-result')
  @HttpCode(HttpStatus.OK)
  async recordResult(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordInterviewResultDto,
  ): Promise<CandidateInterviewResponse> {
    const updated = await this.recordInterviewResult.execute(
      new RecordInterviewResultCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        dto.result,
        dto.qualitativeNotes,
      ),
    );
    return toCandidateInterviewResponse(updated);
  }
}
