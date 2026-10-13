import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { GetMyEmployeeQuery } from '../../application/queries/get-my-employee.query';
import { GetMyEmployeeHandler } from '../../application/queries/get-my-employee.handler';
import { MyEmployeeQueryDto } from './dto/my-employee-query.dto';
import type { MyEmployeeResponse } from './dto/hr-administration.response';
import { toMyEmployeeResponse } from './hr-administration.mapper';

/**
 * GET /me/employee: la ficha del propio usuario (ADP-06 — el trabajador de campo no elige colaborador a mano).
 * No exige ningún permiso de Personal: solo una asignación vigente en esa empresa/sede.
 */
@Controller('me')
@UseGuards(FirebaseAuthGuard)
export class MeEmployeeController {
  constructor(private readonly getMyEmployee: GetMyEmployeeHandler) {}

  @Get('employee')
  async employee(@Req() req: AuthenticatedRequest, @Query() query: MyEmployeeQueryDto): Promise<MyEmployeeResponse> {
    const employee = await this.getMyEmployee.execute(
      new GetMyEmployeeQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
    return toMyEmployeeResponse(employee);
  }
}
