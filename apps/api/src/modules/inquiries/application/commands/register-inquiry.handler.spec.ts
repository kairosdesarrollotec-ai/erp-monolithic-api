import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RegisterInquiryHandler } from './register-inquiry.handler';
import { RegisterInquiryCommand, RegisterInquirySnapshot, ProspectInput } from './register-inquiry.command';
import { BRANCH, COMPANY, ORG, buildInquiryRepository, buildWorkContext, buildMatrixAuth } from '../../testing/inquiry-test-fixtures';

const SNAPSHOT: RegisterInquirySnapshot = {
  destination: 'Vilcashuaman',
  estimatedDays: 3,
  travelStartDate: new Date('2026-10-04T00:00:00Z'),
  partySize: 4,
};

const PROSPECT: ProspectInput = {
  fullName: 'Ana Prospecto',
  documentType: 'DNI',
  documentNumber: '12345678',
  nationality: 'PERUANO',
};

function command(prospectOverrides?: Partial<ProspectInput>, customerId?: string) {
  const prospect = prospectOverrides !== undefined ? { ...PROSPECT, ...prospectOverrides } : PROSPECT;
  return new RegisterInquiryCommand('uid-1', COMPANY, BRANCH, 'WHATSAPP', true, SNAPSHOT, customerId, prospect);
}

function commandWithCustomer(customerId: string) {
  return new RegisterInquiryCommand('uid-1', COMPANY, BRANCH, 'WHATSAPP', true, SNAPSHOT, customerId, undefined);
}

describe('RegisterInquiryHandler', () => {
  it('crea Customer con datos del prospecto y persiste la consulta con el customerId resultante (CONFLICT-CON-002)', async () => {
    const inquiries = buildInquiryRepository();
    const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());

    await handler.execute(command());

    expect(inquiries.createCustomer).toHaveBeenCalledWith({
      organizationId: ORG,
      operatingCompanyId: COMPANY,
      fullName: 'Ana Prospecto',
      documentType: 'DNI',
      documentNumber: '12345678',
      nationality: 'PERUANO',
      countryEntryDate: undefined,
    });
    expect(inquiries.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-new',
        destination: 'Vilcashuaman',
        estimatedDays: 3,
      }),
    );
  });

  it('exige prospect o customerId', async () => {
    const inquiries = buildInquiryRepository();
    const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());
    const cmd = new RegisterInquiryCommand('uid-1', COMPANY, BRANCH, 'WHATSAPP', true, SNAPSHOT, undefined, undefined);

    const error = await handler.execute(cmd).catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'PROSPECT_OR_CUSTOMER_REQUIRED' }));
    expect(inquiries.create).not.toHaveBeenCalled();
  });

  it('acepta un cliente formal sin datos de prospecto', async () => {
    const inquiries = buildInquiryRepository();
    const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());

    await handler.execute(commandWithCustomer('cust-1'));

    expect(inquiries.createCustomer).not.toHaveBeenCalled();
    expect(inquiries.create).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'cust-1' }));
  });

  it('acepta la fecha de ingreso al pais para un EXTRANJERO (SC-CON-001.03)', async () => {
    const inquiries = buildInquiryRepository();
    const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());
    const entry = new Date('2026-09-01T00:00:00Z');

    await handler.execute(command({ nationality: 'EXTRANJERO', countryEntryDate: entry }));

    expect(inquiries.createCustomer).toHaveBeenCalledWith(
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
      inquiries.findCustomerById.mockResolvedValue({
        id: 'cust-9',
        organizationId: ORG,
        operatingCompanyId: 'company-2',
        fullName: 'X',
        nationality: null,
        countryEntryDate: null,
      });
      const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());

      await expect(handler.execute(commandWithCustomer('cust-9'))).rejects.toBeInstanceOf(NotFoundException);
      expect(inquiries.create).not.toHaveBeenCalled();
    });

    it('rechaza con 404 un cliente de otra organizacion', async () => {
      const inquiries = buildInquiryRepository();
      inquiries.findCustomerById.mockResolvedValue({
        id: 'cust-9',
        organizationId: 'org-2',
        operatingCompanyId: COMPANY,
        fullName: 'X',
        nationality: null,
        countryEntryDate: null,
      });
      const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());

      await expect(handler.execute(commandWithCustomer('cust-9'))).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza con 404 un cliente inexistente', async () => {
      const inquiries = buildInquiryRepository();
      inquiries.findCustomerById.mockResolvedValue(null);
      const handler = new RegisterInquiryHandler(inquiries, buildWorkContext(), buildMatrixAuth());

      await expect(handler.execute(commandWithCustomer('cust-x'))).rejects.toBeInstanceOf(NotFoundException);
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
