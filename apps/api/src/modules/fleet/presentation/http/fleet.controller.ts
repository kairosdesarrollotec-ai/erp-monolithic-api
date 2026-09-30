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
import { CreateVehicleHandler } from '../../application/commands/create-vehicle.handler';
import { CreateVehicleCommand } from '../../application/commands/create-vehicle.command';
import { UpdateVehicleStatusHandler } from '../../application/commands/update-vehicle-status.handler';
import { UpdateVehicleHandler } from '../../application/commands/update-vehicle.handler';
import { UpdateVehicleStatusCommand } from '../../application/commands/update-vehicle-status.command';
import { UpdateVehicleCommand } from '../../application/commands/update-vehicle.command';
import { ListVehiclesHandler } from '../../application/queries/list-vehicles.handler';
import { ListVehiclesQuery } from '../../application/queries/list-vehicles.query';
import { GetVehicleHandler } from '../../application/queries/get-vehicle.handler';
import { GetVehicleQuery } from '../../application/queries/get-vehicle.query';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { GetVehicleQueryDto } from './dto/get-vehicle-query.dto';
import { ListVehiclesResponse, VehicleResponse } from './dto/vehicle.response';
import { toVehicleResponse } from './vehicle.mapper';

@Controller('fleet')
@UseGuards(FirebaseAuthGuard)
export class FleetController {
  constructor(
    private readonly createVehicleHandler: CreateVehicleHandler,
    private readonly updateVehicleStatusHandler: UpdateVehicleStatusHandler,
    private readonly updateVehicleHandler: UpdateVehicleHandler,
    private readonly listVehiclesHandler: ListVehiclesHandler,
    private readonly getVehicleHandler: GetVehicleHandler,
  ) {}

  @Post('vehicles')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateVehicleDto,
  ): Promise<VehicleResponse> {
    const vehicle = await this.createVehicleHandler.execute(
      new CreateVehicleCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.plate,
        dto.brand,
        dto.model,
        dto.year,
        dto.color,
        dto.category,
        dto.status,
        dto.dailyRate,
        dto.photoUrl,
        dto.assignedBranchId,
      ),
    );

    return toVehicleResponse(vehicle);
  }

  @Get('vehicles')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListVehiclesQueryDto,
  ): Promise<ListVehiclesResponse> {
    const result = await this.listVehiclesHandler.execute(
      new ListVehiclesQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.filterBranchId,
        query.status,
        query.search,
        query.limit,
        query.offset,
      ),
    );

    return {
      items: result.items.map(toVehicleResponse),
      total: result.total,
    };
  }

  @Get('vehicles/:id')
  async get(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetVehicleQueryDto,
  ): Promise<VehicleResponse> {
    const vehicle = await this.getVehicleHandler.execute(
      new GetVehicleQuery(req.firebaseUid!, id, query.companyId, query.branchId),
    );

    return toVehicleResponse(vehicle);
  }

  @Patch('vehicles/:id/status')
  @UseInterceptors(IdempotencyInterceptor)
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleStatusDto,
  ): Promise<VehicleResponse> {
    const vehicle = await this.updateVehicleStatusHandler.execute(
      new UpdateVehicleStatusCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        dto.status,
      ),
    );

    return toVehicleResponse(vehicle);
  }

  @Patch('vehicles/:id')
  @UseInterceptors(IdempotencyInterceptor)
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<VehicleResponse> {
    const vehicle = await this.updateVehicleHandler.execute(
      new UpdateVehicleCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        dto.brand,
        dto.model,
        dto.year,
        dto.color,
        dto.category,
        dto.dailyRate,
        dto.photoUrl,
        dto.assignedBranchId,
      ),
    );

    return toVehicleResponse(vehicle);
  }
}
