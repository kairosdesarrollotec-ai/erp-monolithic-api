import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { CreateCustomerHandler } from '../../application/commands/create-customer.handler';
import { CreateCustomerCommand } from '../../application/commands/create-customer.command';
import { ListCustomersHandler } from '../../application/queries/list-customers.handler';
import { ListCustomersQuery } from '../../application/queries/list-customers.query';
import { GetCustomerHandler } from '../../application/queries/get-customer.handler';
import { GetCustomerQuery } from '../../application/queries/get-customer.query';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { GetCustomerQueryDto } from './dto/get-customer-query.dto';
import { CustomerResponse, ListCustomersResponse } from './dto/customer.response';
import { toCustomerResponse } from './customer.mapper';

function toUtcDate(dateOnly: string | undefined): Date | undefined {
  return dateOnly ? new Date(`${dateOnly}T00:00:00.000Z`) : undefined;
}

@Controller('customers')
@UseGuards(FirebaseAuthGuard)
export class CustomersController {
  constructor(
    private readonly createCustomerHandler: CreateCustomerHandler,
    private readonly listCustomersHandler: ListCustomersHandler,
    private readonly getCustomerHandler: GetCustomerHandler,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCustomerDto,
  ): Promise<CustomerResponse> {
    const customer = await this.createCustomerHandler.execute(
      new CreateCustomerCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.fullName,
        dto.documentType,
        dto.documentNumber,
        dto.nationality,
        toUtcDate(dto.countryEntryDate),
        dto.email,
        dto.phone,
        dto.address,
      ),
    );

    return toCustomerResponse(customer);
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListCustomersQueryDto,
  ): Promise<ListCustomersResponse> {
    const result = await this.listCustomersHandler.execute(
      new ListCustomersQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.search,
        query.limit,
        query.offset,
      ),
    );

    return {
      items: result.items.map(toCustomerResponse),
      total: result.total,
    };
  }

  @Get(':id')
  async get(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetCustomerQueryDto,
  ): Promise<CustomerResponse> {
    const customer = await this.getCustomerHandler.execute(
      new GetCustomerQuery(req.firebaseUid!, id, query.companyId, query.branchId),
    );

    return toCustomerResponse(customer);
  }
}
