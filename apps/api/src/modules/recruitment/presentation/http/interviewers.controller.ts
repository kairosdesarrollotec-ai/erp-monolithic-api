import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { ListInterviewersHandler } from '../../application/queries/list-interviewers.handler';
import { ListInterviewersQuery } from '../../application/queries/list-interviewers.query';
import { ListInterviewersQueryDto } from './dto/list-interviewers-query.dto';
import { InterviewerListResponse } from './dto/recruitment.response';
import { toInterviewerListResponse } from './recruitment.mapper';

@Controller('interviewers')
@UseGuards(FirebaseAuthGuard)
export class InterviewersController {
  constructor(private readonly listInterviewers: ListInterviewersHandler) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListInterviewersQueryDto,
  ): Promise<InterviewerListResponse> {
    const items = await this.listInterviewers.execute(
      new ListInterviewersQuery(req.firebaseUid!, query.companyId, query.branchId, query.q, query.limit),
    );
    return toInterviewerListResponse(items);
  }
}
