import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  AuthenticatedRequest,
  FirebaseAuthGuard,
} from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { CreateTemplateHandler } from '../../application/commands/create-template.handler';
import { CreateTemplateCommand } from '../../application/commands/create-template.command';
import { RequestTemplateUploadUrlHandler } from '../../application/commands/request-template-upload-url.handler';
import { RequestTemplateUploadUrlCommand } from '../../application/commands/request-template-upload-url.command';
import { ActivateTemplateHandler } from '../../application/commands/activate-template.handler';
import { ActivateTemplateCommand } from '../../application/commands/activate-template.command';
import { ListTemplatesHandler } from '../../application/queries/list-templates.handler';
import { ListTemplatesQuery } from '../../application/queries/list-templates.query';
import { GetTemplateHandler } from '../../application/queries/get-template.handler';
import { GetTemplateQuery } from '../../application/queries/get-template.query';
import { CreateTemplateDto } from './dto/create-template.dto';
import { RequestTemplateUploadUrlDto } from './dto/request-template-upload-url.dto';
import { ActivateTemplateDto } from './dto/activate-template.dto';
import { ListTemplatesQueryDto } from './dto/list-templates-query.dto';
import { GetTemplateQueryDto } from './dto/get-template-query.dto';
import { TemplateResponse } from './dto/template.response';
import { TemplateUploadUrlResponse } from './dto/template-upload-url.response';
import { toTemplateResponse } from './template.mapper';

/**
 * TDD-KAIROS-MVP-002-TPL §6 — Gestión de plantillas de documentos (DRAFT→ACTIVE→RETIRED).
 * Contrato: packages/contracts/openapi/templates.yaml
 * Todos los POST aplican IdempotencyInterceptor.
 */
@Controller('templates')
@UseGuards(FirebaseAuthGuard)
export class TemplatesController {
  constructor(
    private readonly createTemplate: CreateTemplateHandler,
    private readonly requestUploadUrl: RequestTemplateUploadUrlHandler,
    private readonly activateTemplate: ActivateTemplateHandler,
    private readonly listTemplates: ListTemplatesHandler,
    private readonly getTemplate: GetTemplateHandler,
  ) {}

  /** TDD-TPL §6.1 — Crear plantilla en estado DRAFT. */
  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTemplateDto,
  ): Promise<TemplateResponse> {
    const created = await this.createTemplate.execute(
      new CreateTemplateCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.type,
        dto.name,
        dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
      ),
    );
    return toTemplateResponse(created);
  }

  /** TDD-TPL §6.4 — Listar plantillas con filtros opcionales. */
  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListTemplatesQueryDto,
  ): Promise<TemplateResponse[]> {
    const results = await this.listTemplates.execute(
      new ListTemplatesQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.type,
        query.status,
      ),
    );
    return results.map(toTemplateResponse);
  }

  /** TDD-TPL §6.5 — Obtener plantilla por ID. */
  @Get(':id')
  async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetTemplateQueryDto,
  ): Promise<TemplateResponse> {
    const template = await this.getTemplate.execute(
      new GetTemplateQuery(id, req.firebaseUid!, query.companyId, query.branchId),
    );
    return toTemplateResponse(template);
  }

  /** TDD-TPL §6.2 — Solicitar URL firmada GCS para subir el documento. */
  @Post(':id/upload-url')
  @UseInterceptors(IdempotencyInterceptor)
  async uploadUrl(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestTemplateUploadUrlDto,
  ): Promise<TemplateUploadUrlResponse> {
    const result = await this.requestUploadUrl.execute(
      new RequestTemplateUploadUrlCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        dto.contentType,
        dto.contentLength,
      ),
    );
    return {
      uploadUrl: result.uploadUrl,
      objectUrl: result.objectUrl,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  /** TDD-TPL §6.3 + TDD-TPL-ADR-003 — Activar plantilla y retirar la anterior. */
  @Post(':id/commands/activate')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async activate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActivateTemplateDto,
  ): Promise<TemplateResponse> {
    const activated = await this.activateTemplate.execute(
      new ActivateTemplateCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        dto.objectUrl,
        dto.documentFormat,
      ),
    );
    return toTemplateResponse(activated);
  }
}
