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
import { RequestPhotoUploadSessionHandler } from '../../application/commands/request-photo-upload-session.handler';
import { RequestPhotoUploadSessionDto } from './dto/request-photo-upload-session.dto';
import { PhotoUploadSessionResponse } from './dto/photo-upload-session.response';
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
import { VehiclePhotoStoragePort } from '../../application/ports/vehicle-photo-storage.port';

@Controller('fleet')
@UseGuards(FirebaseAuthGuard)
export class FleetController {
  constructor(
    private readonly createVehicleHandler: CreateVehicleHandler,
    private readonly updateVehicleStatusHandler: UpdateVehicleStatusHandler,
    private readonly updateVehicleHandler: UpdateVehicleHandler,
    private readonly listVehiclesHandler: ListVehiclesHandler,
    private readonly getVehicleHandler: GetVehicleHandler,
    private readonly requestPhotoUploadSessionHandler: RequestPhotoUploadSessionHandler,
    private readonly photoStorage: VehiclePhotoStoragePort,
  ) {}

  private async withSignedPhotoUrl(response: VehicleResponse): Promise<VehicleResponse> {
    if (!response.photoUrl) return response;
    return { ...response, photoUrl: await this.photoStorage.generateSignedReadUrl(response.photoUrl) };
  }

  @Post('vehicles/photo-upload-sessions')
  @HttpCode(HttpStatus.CREATED)
  async requestPhotoUploadSession(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RequestPhotoUploadSessionDto,
  ): Promise<PhotoUploadSessionResponse> {
    return this.requestPhotoUploadSessionHandler.execute({
      firebaseUid: req.firebaseUid!,
      companyId: dto.companyId,
      branchId: dto.branchId,
      contentType: dto.contentType,
      contentLength: dto.contentLength,
    });
  }

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
        dto.depositMinimum,
        dto.photoUrl,
        dto.assignedBranchId,
      ),
    );

    return this.withSignedPhotoUrl(toVehicleResponse(vehicle));
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
        query.availableFrom,
        query.availableTo,
      ),
    );

    const items = await Promise.all(
      result.items.map((v) => this.withSignedPhotoUrl(toVehicleResponse(v))),
    );

    return { items, total: result.total };
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

    return this.withSignedPhotoUrl(toVehicleResponse(vehicle));
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

    return this.withSignedPhotoUrl(toVehicleResponse(vehicle));
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
        dto.depositMinimum,
        dto.photoUrl,
        dto.assignedBranchId,
      ),
    );

    return this.withSignedPhotoUrl(toVehicleResponse(vehicle));
  }
}
