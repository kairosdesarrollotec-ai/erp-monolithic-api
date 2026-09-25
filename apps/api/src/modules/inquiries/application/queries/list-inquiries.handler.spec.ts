import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ListInquiriesHandler } from './list-inquiries.handler';
import { ListInquiriesQuery } from './list-inquiries.query';
import { INQUIRY_LIST_DEFAULT_LIMIT, INQUIRY_LIST_MAX_LIMIT } from '../../domain/inquiry-pagination';
import { BRANCH, COMPANY, ORG, SCOPE, buildInquiryRepository, buildWorkContext, buildMatrixAuth } from '../../testing/inquiry-test-fixtures';

function query(overrides: { limit?: number; from?: Date; to?: Date; cursor?: { createdAt: Date; id: string } } = {}) {
  return new ListInquiriesQuery(
    'uid-1',
    COMPANY,
    BRANCH,
    undefined,
    undefined,
    undefined,
    overrides.from,
    overrides.to,
    overrides.limit ?? INQUIRY_LIST_DEFAULT_LIMIT,
    overrides.cursor,
  );
}

describe('ListInquiriesHandler', () => {
  it('lista con el scope autorizado completo y pasa limit/cursor keyset al repositorio', async () => {
    const inquiries = buildInquiryRepository();
    const handler = new ListInquiriesHandler(inquiries, buildWorkContext(), buildMatrixAuth());
    const cursor = { createdAt: new Date('2026-09-20T00:00:00Z'), id: 'inq-9' };

    await handler.execute(query({ limit: 50, cursor }));

    expect(inquiries.list).toHaveBeenCalledWith(expect.objectContaining({ ...SCOPE, limit: 50, cursor }));
  });

  it(`acepta el limite maximo (${INQUIRY_LIST_MAX_LIMIT})`, async () => {
    const inquiries = buildInquiryRepository();
    const handler = new ListInquiriesHandler(inquiries, buildWorkContext(), buildMatrixAuth());

    await handler.execute(query({ limit: INQUIRY_LIST_MAX_LIMIT }));

    expect(inquiries.list).toHaveBeenCalled();
  });

  it.each([INQUIRY_LIST_MAX_LIMIT + 1, 0, 1000])('rechaza limit=%p (hallazgo MEDIO: maximo igual a OpenAPI)', async (limit) => {
    const inquiries = buildInquiryRepository();
    const handler = new ListInquiriesHandler(inquiries, buildWorkContext(), buildMatrixAuth());

    const error = await handler.execute(query({ limit })).catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'INVALID_LIMIT' }));
    expect(inquiries.list).not.toHaveBeenCalled();
  });

  it('rechaza si createdFrom es posterior a createdTo', async () => {
    const handler = new ListInquiriesHandler(buildInquiryRepository(), buildWorkContext(), buildMatrixAuth());

    await expect(
      handler.execute(query({ from: new Date('2026-09-10T00:00:00Z'), to: new Date('2026-09-01T00:00:00Z') })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta createdFrom igual a createdTo (rango inclusivo)', async () => {
    const inquiries = buildInquiryRepository();
    const handler = new ListInquiriesHandler(inquiries, buildWorkContext(), buildMatrixAuth());
    const day = new Date('2026-09-10T00:00:00Z');

    await handler.execute(query({ from: day, to: day }));

    expect(inquiries.list).toHaveBeenCalled();
  });

  it('RBAC: rechaza la bandeja para un rol sin lectura (CAMPO)', async () => {
    const handler = new ListInquiriesHandler(buildInquiryRepository(), buildWorkContext('CAMPO'), buildMatrixAuth());

    await expect(handler.execute(query())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza si la combinacion empresa/sede no es valida', async () => {
    const handler = new ListInquiriesHandler(buildInquiryRepository(), buildWorkContext('forbidden'), buildMatrixAuth());

    await expect(handler.execute(query())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('consulta MatrixAuthorizationService para assertAllowed con modulo INQUIRY y accion READ', async () => {
    const inquiries = buildInquiryRepository();
    const matrixAuth = buildMatrixAuth();
    const handler = new ListInquiriesHandler(inquiries, buildWorkContext('FRONT_OFFICE'), matrixAuth);

    await handler.execute(query());

    expect(matrixAuth.assertAllowed).toHaveBeenCalledWith(ORG, 'FRONT_OFFICE', 'INQUIRY', 'READ');
  });
});
