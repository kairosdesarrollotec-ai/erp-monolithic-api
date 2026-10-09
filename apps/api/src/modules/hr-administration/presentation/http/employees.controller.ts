import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { CreateEmployeeCommand } from '../../application/commands/create-employee.command';
import { CreateEmployeeHandler } from '../../application/commands/create-employee.handler';
import { UpdateEmployeeCommand } from '../../application/commands/update-employee.command';
import { UpdateEmployeeHandler } from '../../application/commands/update-employee.handler';
import { TerminateEmploymentCommand } from '../../application/commands/terminate-employment.command';
import { TerminateEmploymentHandler } from '../../application/commands/terminate-employment.handler';
import { ListEmployeesQuery } from '../../application/queries/list-employees.query';
import { ListEmployeesHandler } from '../../application/queries/list-employees.handler';
import { GetEmployeeDetailQuery } from '../../application/queries/get-employee-detail.query';
import { GetEmployeeDetailHandler } from '../../application/queries/get-employee-detail.handler';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { TerminateEmploymentDto } from './dto/terminate-employment.dto';
import { parseDateOnly } from './dto/hr-date';
import type {
  EmployeeDetailResponse,
  EmployeeListResponse,
  EmployeeResponse,
  EmploymentTerminationResponse,
} from './dto/hr-administration.response';
import {
  toEmployeeDetailResponse,
  toEmployeeResponse,
  toEmploymentTerminationResponse,
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
  ) {}

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
        dto.areaId,
        dto.areaName,
        dto.jobTitle,
        parseDateOnly(dto.hireDate),
        dto.email,
        dto.phone,
        dto.baseSalary,
        dto.candidateId,
      ),
    );
    return toEmployeeResponse(created);
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
        query.areaId,
        query.search,
        query.limit,
        query.offset,
      ),
    );
    return { items: result.items.map(toEmployeeResponse), total: result.total };
  }

  @Get(':id')
  async getDetail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeDetailResponse> {
    const detail = await this.getEmployeeDetail.execute(new GetEmployeeDetailQuery(req.firebaseUid!, id));
    return toEmployeeDetailResponse(detail);
  }

  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<EmployeeResponse> {
    const { payrollStartedAt, ...rest } = dto;
    const data: UpdateEmployeeData = {
      ...rest,
      ...(payrollStartedAt !== undefined
        ? { payrollStartedAt: payrollStartedAt === null ? null : new Date(payrollStartedAt) }
        : {}),
    };
    const updated = await this.updateEmployee.execute(new UpdateEmployeeCommand(req.firebaseUid!, id, data));
    return toEmployeeResponse(updated);
  }

  @Post(':id/terminate')
  @HttpCode(HttpStatus.OK)
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
