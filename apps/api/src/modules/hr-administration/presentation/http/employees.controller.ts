import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { parseVersionIfMatch } from '../../../../common/http/etag';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { RecentAuth, RecentAuthGuard } from '../../../users/infrastructure/auth/recent-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { CreateEmployeeCommand } from '../../application/commands/create-employee.command';
import { CreateEmployeeHandler } from '../../application/commands/create-employee.handler';
import { UpdateEmployeeCommand } from '../../application/commands/update-employee.command';
import { UpdateEmployeeHandler } from '../../application/commands/update-employee.handler';
import { LinkEmployeeAccountCommand } from '../../application/commands/link-employee-account.command';
import { LinkEmployeeAccountHandler } from '../../application/commands/link-employee-account.handler';
import { TerminateEmploymentCommand } from '../../application/commands/terminate-employment.command';
import { TerminateEmploymentHandler } from '../../application/commands/terminate-employment.handler';
import { ListEmployeesQuery } from '../../application/queries/list-employees.query';
import { ListEmployeesHandler } from '../../application/queries/list-employees.handler';
import { GetEmployeeDetailQuery } from '../../application/queries/get-employee-detail.query';
import { GetEmployeeDetailHandler } from '../../application/queries/get-employee-detail.handler';
import { GetEmployeeMemosQuery } from '../../application/queries/get-employee-memos.query';
import { GetEmployeeMemosHandler } from '../../application/queries/get-employee-memos.handler';
import { GetEmployeeTrainingsQuery } from '../../application/queries/get-employee-trainings.query';
import { GetEmployeeTrainingsHandler } from '../../application/queries/get-employee-trainings.handler';
import { EmployeeFieldVisibilityService } from '../../application/services/employee-field-visibility.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { TerminateEmploymentDto } from './dto/terminate-employment.dto';
import { parseDateOnly } from './dto/hr-date';
import { areaFilterCode } from '../../domain/hr-area-rules';
import type {
  EmployeeDetailResponse,
  EmployeeListResponse,
  EmployeeResponse,
  EmploymentTerminationResponse,
  UpdateEmployeeResponse,
  HrMemoResponse,
  TrainingResponse,
} from './dto/hr-administration.response';
import {
  toEmployeeDetailResponse,
  toEmployeeResponse,
  toEmploymentTerminationResponse,
  toHrMemoResponse,
  toTrainingResponse,
} from './hr-administration.mapper';
import type { UpdateEmployeeData } from '../../application/ports/employee-repository.port';

@Controller('employees')
@UseGuards(FirebaseAuthGuard)
export class EmployeesController {
  constructor(
    private readonly createEmployee: CreateEmployeeHandler,
    private readonly updateEmployee: UpdateEmployeeHandler,
    private readonly terminateEmployment: TerminateEmploymentHandler,
    private readonly listEmployees: ListEmployeesHandler,
    private readonly getEmployeeDetail: GetEmployeeDetailHandler,
    private readonly getEmployeeMemos: GetEmployeeMemosHandler,
    private readonly getEmployeeTrainings: GetEmployeeTrainingsHandler,
    private readonly linkEmployeeAccount: LinkEmployeeAccountHandler,
    private readonly visibility: EmployeeFieldVisibilityService,
  ) {}

  private scopeVisibility(req: AuthenticatedRequest, e: { operatingCompanyId: string; branchId: string }) {
    return this.visibility.resolve({
      firebaseUid: req.firebaseUid!,
      companyId: e.operatingCompanyId,
      branchId: e.branchId,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateEmployeeDto): Promise<EmployeeResponse> {
    const created = await this.createEmployee.execute(
      new CreateEmployeeCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.documentType ?? 'DNI',
        dto.documentNumber,
        dto.fullName,
        dto.areaId ?? '',
        dto.areaName ?? '',
        dto.jobTitle,
        parseDateOnly(dto.hireDate),
        dto.email,
        dto.phone,
        dto.baseSalary,
        dto.candidateId,
        dto.areaCode,
        dto.bankName,
        dto.bankAccountNumber,
        dto.bankAccountCci,
        dto.contractType,
        dto.contractUrl,
        dto.contractNotes,
      ),
    );
    return toEmployeeResponse(created, await this.scopeVisibility(req, created));
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListEmployeesQueryDto,
  ): Promise<EmployeeListResponse> {
    const result = await this.listEmployees.execute(
      new ListEmployeesQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.status,
        query.areaCode ? areaFilterCode(query.areaCode) : query.areaId,
        query.search,
        query.limit,
        query.offset,
      ),
    );
    const visibility = await this.visibility.resolve({
      firebaseUid: req.firebaseUid!,
      companyId: query.companyId,
      branchId: query.branchId,
    });
    return { items: result.items.map((e) => toEmployeeResponse(e, visibility)), total: result.total };
  }

  @Get(':id')
  async getDetail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EmployeeDetailResponse> {
    const detail = await this.getEmployeeDetail.execute(new GetEmployeeDetailQuery(req.firebaseUid!, id));
    res.setHeader('ETag', `"${detail.employee.version}"`);
    return toEmployeeDetailResponse(detail, await this.scopeVisibility(req, detail.employee));
  }

  @Get(':id/memos')
  async listMemos(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<HrMemoResponse[]> {
    const result = await this.getEmployeeMemos.execute(new GetEmployeeMemosQuery(req.firebaseUid!, id));
    return result.items.map((m) => toHrMemoResponse(m, result.employeeName));
  }

  @Get(':id/trainings')
  async listTrainings(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TrainingResponse[]> {
    const result = await this.getEmployeeTrainings.execute(new GetEmployeeTrainingsQuery(req.firebaseUid!, id));
    return result.items.map(toTrainingResponse);
  }

  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UpdateEmployeeResponse> {
    const { payrollStartedAt, ...rest } = dto;
    const data: UpdateEmployeeData = {
      ...rest,
      ...(payrollStartedAt !== undefined
        ? { payrollStartedAt: payrollStartedAt === null ? null : new Date(payrollStartedAt) }
        : {}),
    };
    // DEC-ADP-EDIT-ETAG-001: If-Match es OPCIONAL (compatibilidad); si viene, debe ser un ETag fuerte de versión y la edición
    // falla con 412 EMPLOYEE_VERSION_CONFLICT si la ficha cambió.
    const expectedVersion = ifMatch === undefined || ifMatch.trim() === '' ? undefined : parseVersionIfMatch(ifMatch);
    const { employee, accountRelink, previousEmail } = await this.updateEmployee.executeDetailed(
      new UpdateEmployeeCommand(req.firebaseUid!, id, data, expectedVersion),
    );
    res.setHeader('ETag', `"${employee.version}"`);
    return {
      ...toEmployeeResponse(employee, await this.scopeVisibility(req, employee)),
      ...(accountRelink
        ? { accountRelink: { action: accountRelink, reason: 'EMAIL_CHANGED' as const, previousEmail, newEmail: employee.email ?? null } }
        : {}),
    };
  }

  /** DEC-ADP-LINK-EMAIL-001: vincula la ficha con la cuenta de usuario del mismo correo (409 si ya está vinculado a otro). */
  @Post(':id/link-account')
  @HttpCode(HttpStatus.OK)
  async linkAccount(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeResponse> {
    const linked = await this.linkEmployeeAccount.execute(new LinkEmployeeAccountCommand(req.firebaseUid!, id));
    return toEmployeeResponse(linked, await this.scopeVisibility(req, linked));
  }

  @Post(':id/terminate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RecentAuthGuard)
  @RecentAuth(300)
  async terminate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TerminateEmploymentDto,
  ): Promise<EmploymentTerminationResponse> {
    const result = await this.terminateEmployment.execute(
      new TerminateEmploymentCommand(
        req.firebaseUid!,
        id,
        dto.reason,
        dto.noticeDays ?? 0,
        dto.finalSettlementPaid,
        dto.settlementAmount ?? 0,
        dto.notes,
      ),
    );
    return toEmploymentTerminationResponse(result.termination, result.employee.fullName);
  }
}
