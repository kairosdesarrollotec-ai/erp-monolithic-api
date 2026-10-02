import { Body, Controller, Get, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { CreateContractTemplateHandler } from '../../application/commands/create-contract-template.handler';
import { CreateContractTemplateCommand } from '../../application/commands/create-contract-template.command';
import { ListContractTemplatesHandler } from '../../application/queries/list-contract-templates.handler';
import { ListContractTemplatesQuery } from '../../application/queries/list-contract-templates.query';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { ListContractTemplatesQueryDto } from './dto/list-contract-templates-query.dto';
import { ContractTemplateResponse } from './dto/contract-template.response';
import { toContractTemplateResponse } from './contract-template.mapper';

/**
 * ADM / BR-DOC-002 - gestion de plantillas de contrato (TDD-ALQ-001.md
 * seccion 9.3). Vive como sub-dominio de rentals (no como modulo propio)
 * porque RentalRepositoryPort ya expone findActiveContractTemplate /
 * contractTemplateBelongsToCompany, usados por formalize-contract.
 */
@Controller('rentals/contract-templates')
@UseGuards(FirebaseAuthGuard)
export class ContractTemplatesController {
  constructor(
    private readonly createContractTemplate: CreateContractTemplateHandler,
    private readonly listContractTemplates: ListContractTemplatesHandler,
  ) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateContractTemplateDto,
  ): Promise<ContractTemplateResponse> {
    const created = await this.createContractTemplate.execute(
      new CreateContractTemplateCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.type,
        dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
      ),
    );
    return toContractTemplateResponse(created);
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListContractTemplatesQueryDto,
  ): Promise<ContractTemplateResponse[]> {
    const results = await this.listContractTemplates.execute(
      new ListContractTemplatesQuery(req.firebaseUid!, query.companyId, query.branchId),
    );
    return results.map(toContractTemplateResponse);
  }
}
