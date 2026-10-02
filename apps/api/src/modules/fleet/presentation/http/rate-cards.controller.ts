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
} from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { CreateRateCardHandler } from '../../application/commands/create-rate-card.handler';
import { CreateRateCardCommand } from '../../application/commands/create-rate-card.command';
import { ListRateCardsHandler } from '../../application/queries/list-rate-cards.handler';
import { ListRateCardsQuery } from '../../application/queries/list-rate-cards.query';
import { GetCurrentRateCardHandler } from '../../application/queries/get-current-rate-card.handler';
import { GetCurrentRateCardQuery } from '../../application/queries/get-current-rate-card.query';
import { CreateRateCardDto } from './dto/create-rate-card.dto';
import { ListRateCardsQueryDto } from './dto/list-rate-cards-query.dto';
import { ListRateCardsResponse, RateCardResponse } from './dto/rate-card.response';
import { toRateCardResponse } from './rate-card.mapper';

@Controller('fleet/rate-cards')
@UseGuards(FirebaseAuthGuard)
export class RateCardsController {
  constructor(
    private readonly createRateCardHandler: CreateRateCardHandler,
    private readonly listRateCardsHandler: ListRateCardsHandler,
    private readonly getCurrentRateCardHandler: GetCurrentRateCardHandler,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateRateCardDto,
  ): Promise<RateCardResponse> {
    const rateCard = await this.createRateCardHandler.execute(
      new CreateRateCardCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.amountPerDay,
        dto.currency,
        dto.validityHours,
        new Date(dto.effectiveFrom),
      ),
    );

    return toRateCardResponse(rateCard);
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListRateCardsQueryDto,
  ): Promise<ListRateCardsResponse> {
    const result = await this.listRateCardsHandler.execute(
      new ListRateCardsQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        parseInt(query.limit ?? '25', 10),
        parseInt(query.offset ?? '0', 10),
      ),
    );

    return {
      items: result.items.map(toRateCardResponse),
      total: result.total,
    };
  }

  @Get('current')
  async getCurrent(
    @Req() req: AuthenticatedRequest,
    @Query('companyId') companyId: string,
    @Query('branchId') branchId: string,
  ): Promise<RateCardResponse> {
    const rateCard = await this.getCurrentRateCardHandler.execute(
      new GetCurrentRateCardQuery(req.firebaseUid!, companyId, branchId),
    );

    return toRateCardResponse(rateCard);
  }
}
