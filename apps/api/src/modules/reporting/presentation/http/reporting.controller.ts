import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { FirebaseAuthGuard, AuthenticatedRequest } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { GetOperationalKpisHandler } from '../../application/queries/get-operational-kpis.handler';
import { GetOperationalKpisQuery } from '../../application/queries/get-operational-kpis.query';
import { GetFinancialKpisHandler } from '../../application/queries/get-financial-kpis.handler';
import { GetFinancialKpisQuery } from '../../application/queries/get-financial-kpis.query';
import { ExportReportHandler } from '../../application/queries/export-report.handler';
import { ExportReportQuery } from '../../application/queries/export-report.query';
import { OperationalKpisQueryDto, FinancialKpisQueryDto, ExportQueryDto } from './dto/reporting-query.dto';
import type { OperationalKpisResult } from './dto/operational-kpis.response';
import type { FinancialKpisResult } from './dto/financial-kpis.response';
import { limaTodayString, parseBusinessInstant } from '../../../../common/time/lima-time';

/**
 * Reportes (REP-01) — módulo de solo lectura.
 * Contrato: packages/contracts/openapi/reporting.yaml.
 *
 * Todos los endpoints requieren autenticación Firebase (guard global registrado en AppModule).
 * La autorización por permiso (REPORT.READ_OPERATIONAL / READ_FINANCIAL / EXPORT) se evalúa
 * en cada handler vía MatrixAuthorizationService (ADM-02, deny-by-default).
 *
 * BR-REP-004: aislamiento multiempresa — companyId del parámetro de query es obligatorio
 * y se valida contra el contexto de trabajo del actor autenticado.
 */
@Controller('reporting')
@UseGuards(FirebaseAuthGuard)
export class ReportingController {
  constructor(
    private readonly getOperationalKpis: GetOperationalKpisHandler,
    private readonly getFinancialKpis: GetFinancialKpisHandler,
    private readonly exportReport: ExportReportHandler,
  ) {}

  /**
   * GET /reporting/operational
   * BR-REP-001: requiere REPORT.READ_OPERATIONAL.
   */
  @Get('operational')
  async operational(
    @Req() req: AuthenticatedRequest,
    @Query() query: OperationalKpisQueryDto,
  ): Promise<OperationalKpisResult> {
    // DEC-TZ-LIMA-001: date-only = dia de America/Lima.
    const today = limaTodayString();
    const dateFrom = parseBusinessInstant(query.dateFrom ?? today);
    const dateTo = parseBusinessInstant(query.dateTo ?? today);

    return this.getOperationalKpis.execute(
      new GetOperationalKpisQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        dateFrom,
        dateTo,
      ),
    );
  }

  /**
   * GET /reporting/financial
   * BR-REP-002: requiere REPORT.READ_FINANCIAL.
   * BR-REP-005: dateFrom y dateTo son obligatorios; rango máximo 90 días.
   */
  @Get('financial')
  async financial(
    @Req() req: AuthenticatedRequest,
    @Query() query: FinancialKpisQueryDto,
  ): Promise<FinancialKpisResult> {
    return this.getFinancialKpis.execute(
      new GetFinancialKpisQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        parseBusinessInstant(query.dateFrom),
        parseBusinessInstant(query.dateTo),
      ),
    );
  }

  /**
   * GET /reporting/export
   * BR-REP-003: requiere REPORT.EXPORT.
   * BR-REP-005: rango máximo 90 días.
   * Responde con Content-Type: text/csv y cabecera Content-Disposition.
   */
  @Get('export')
  async export(
    @Req() req: AuthenticatedRequest,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const exportType: 'operational' | 'financial' | 'combined' = query.type ?? 'combined';

    const result = await this.exportReport.execute(
      new ExportReportQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        parseBusinessInstant(query.dateFrom),
        parseBusinessInstant(query.dateTo),
        exportType,
      ),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.csv);
  }
}
