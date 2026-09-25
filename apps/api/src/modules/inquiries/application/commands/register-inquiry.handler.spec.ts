import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RegisterInquiryHandler } from './register-inquiry.handler';
import { RegisterInquiryCommand, RegisterInquirySnapshot } from './register-inquiry.command';
import { BRANCH, COMPANY, ORG, buildInquiryRepository, buildWorkContext, buildMatrixAuth } from '../../testing/inquiry-test-fixtures';

const SNAPSHOT: RegisterInquirySnapshot = {
  nationality: 'PERUANO',
  destination: 'Vilcashuaman',
  estimatedDays: 3,
  prospectName: 'Ana Prospecto',
  prospectDocumentType: 'DNI',
  prospectDocumentNumber: '12345678',
  travelStartDate: new Date('2026-10-04T00:00:00Z'),
  partySize: 4,
};

function command(overrides: Partial<RegisterInquirySnapshot> = {}, customerId?: string) {
  return new RegisterInquiryCommand('uid-1', COMPANY, BRANCH, 'WHATSAPP', true, { ...SNAPSHOT, ...overrides }, customerId);
}

describe('RegisterInquiryHandler', () => {
  it('persiste el snapshot completo de CON-02 (prospecto, nacionalidad, destino, dias, periodo, personas) - hallazgo ALTO CON-02', async () => {
    const inquiries = buildInquiryRepository();
    const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());

    await handler.execute(command());

    expect(inquiries.create).toHaveBeenCalledWith({
      organizationId: ORG,
      operatingCompanyId: COMPANY,
      branchId: BRANCH,
      customerId: undefined,
      channel: 'WHATSAPP',
      touristUse: true,
      prospectName: 'Ana Prospecto',
      prospectDocumentType: 'DNI',
      prospectDocumentNumber: '12345678',
      nationality: 'PERUANO',
      destination: 'Vilcashuaman',
      estimatedDays: 3,
      travelStartDate: new Date('2026-10-04T00:00:00Z'),
      partySize: 4,
      countryEntryDate: undefined,
      createdBy: 'uid-1',
    });
  });

  it('exige el nombre del prospecto cuando no hay cliente formal (CON-P02)', async () => {
    const inquiries = buildInquiryRepository();
    const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());

    const error = await handler.execute(command({ prospectName: '   ' })).catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'PROSPECT_NAME_REQUIRED' }));
    expect(inquiries.create).not.toHaveBeenCalled();
  });

  it('acepta un cliente formal sin nombre de prospecto', async () => {
    const inquiries = buildInquiryRepository();
    const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());

    await handler.execute(command({ prospectName: undefined }, 'cust-1'));

    expect(inquiries.create).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'cust-1', prospectName: undefined }));
  });

  it('acepta la fecha de ingreso al pais para un EXTRANJERO (SC-CON-001.03)', async () => {
    const inquiries = buildInquiryRepository();
    const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());
    const entry = new Date('2026-09-01T00:00:00Z');

    await handler.execute(command({ nationality: 'EXTRANJERO', countryEntryDate: entry }));

    expect(inquiries.create).toHaveBeenCalledWith(
      expect.objectContaining({ nationality: 'EXTRANJERO', countryEntryDate: entry }),
    );
  });

  it('rechaza la fecha de ingreso al pais para un PERUANO', async () => {
    const inquiries = buildInquiryRepository();
    const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());

    const error = await handler.execute(command({ countryEntryDate: new Date() })).catch((e) => e);

    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'COUNTRY_ENTRY_DATE_ONLY_FOR_FOREIGNERS' }));
  });

  describe('aislamiento del cliente (hallazgo ALTO: organizacion + empresa)', () => {
    it('rechaza con 404 un cliente de OTRA empresa de la misma organizacion (cross-company)', async () => {
      const inquiries = buildInquiryRepository();
      inquiries.findCustomerById.mockResolvedValue({ id: 'cust-9', organizationId: ORG, operatingCompanyId: 'company-2' });
      const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());

      await expect(handler.execute(command({}, 'cust-9'))).rejects.toBeInstanceOf(NotFoundException);
      expect(inquiries.create).not.toHaveBeenCalled();
    });

    it('rechaza con 404 un cliente de otra organizacion', async () => {
      const inquiries = buildInquiryRepository();
      inquiries.findCustomerById.mockResolvedValue({ id: 'cust-9', organizationId: 'org-2', operatingCompanyId: COMPANY });
      const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());

      await expect(handler.execute(command({}, 'cust-9'))).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza con 404 un cliente inexistente', async () => {
      const inquiries = buildInquiryRepository();
      inquiries.findCustomerById.mockResolvedValue(null);
      const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());

      await expect(handler.execute(command({}, 'cust-x'))).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('RBAC (hallazgo ALTO: politica rol-accion deny-by-default)', () => {
    it.each(['GERENCIA', 'AUDITORIA', 'ADMINISTRACION', 'CAMPO', 'FINANZAS', 'RRHH'] as const)(
      'rechaza registrar con rol %s (solo Front-office gestiona Consultas)',
      async (role) => {
        const inquiries = buildInquiryRepository();
        const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(role), buildMatrixAuth());

        await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
        expect(inquiries.create).not.toHaveBeenCalled();
      },
    );

    it('rechaza si la combinacion empresa/sede no es una asignacion vigente', async () => {
      const handler = new RegisterInquiryHandler(buildInquiryRepository(), buildWorkContext('forbidden'), buildMatrixAuth());

      await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('consulta MatrixAuthorizationService para assertAllowed con modulo INQUIRY y accion REGISTER', async () => {
      const inquiries = buildInquiryRepository();
      const matrixAuth = buildMatrixAuth();
      const handler = new RegisterInquiryHandler(inquiries, buildWorkContext('FRONT_OFFICE'), matrixAuth);

      await handler.execute(command());

      expect(matrixAuth.assertAllowed).toHaveBeenCalledWith(ORG, 'FRONT_OFFICE', 'INQUIRY', 'REGISTER');
    });
  });
});
