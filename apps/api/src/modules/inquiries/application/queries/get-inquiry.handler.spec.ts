import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetInquiryHandler } from './get-inquiry.handler';
import { GetInquiryQuery } from './get-inquiry.query';
import { BRANCH, COMPANY, SCOPE, buildInquiry, buildInquiryRepository, buildWorkContext } from '../../testing/inquiry-test-fixtures';

describe('GetInquiryHandler', () => {
  it('busca con el scope completo autorizado (organizacion + empresa + sede)', async () => {
    const inquiries = buildInquiryRepository(buildInquiry());
    const handler = new GetInquiryHandler(inquiries, buildWorkContext());

    const result = await handler.execute(new GetInquiryQuery('inq-1', 'uid-1', COMPANY, BRANCH));

    expect(inquiries.findById).toHaveBeenCalledWith('inq-1', SCOPE);
    expect(result.id).toBe('inq-1');
  });

  it('responde 404 para una consulta de otra sede de la misma empresa (cross-branch)', async () => {
    const inquiries = buildInquiryRepository(null);
    const handler = new GetInquiryHandler(inquiries, buildWorkContext());

    await expect(handler.execute(new GetInquiryQuery('inq-otra-sede', 'uid-1', COMPANY, BRANCH))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each(['FRONT_OFFICE', 'GERENCIA', 'AUDITORIA', 'ADMINISTRACION'] as const)('RBAC: permite leer con rol %s', async (role) => {
    const handler = new GetInquiryHandler(buildInquiryRepository(buildInquiry()), buildWorkContext(role));

    await expect(handler.execute(new GetInquiryQuery('inq-1', 'uid-1', COMPANY, BRANCH))).resolves.toBeDefined();
  });

  it.each(['CAMPO', 'FINANZAS', 'RRHH'] as const)('RBAC: rechaza leer con rol %s (deny-by-default)', async (role) => {
    const handler = new GetInquiryHandler(buildInquiryRepository(buildInquiry()), buildWorkContext(role));

    await expect(handler.execute(new GetInquiryQuery('inq-1', 'uid-1', COMPANY, BRANCH))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rechaza si la combinacion empresa/sede no es una asignacion vigente', async () => {
    const handler = new GetInquiryHandler(buildInquiryRepository(buildInquiry()), buildWorkContext('forbidden'));

    await expect(handler.execute(new GetInquiryQuery('inq-1', 'uid-1', 'company-x', 'branch-x'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
