import { CandidatesController } from './candidates.controller';

/** R-1: el detalle del candidato no debe servirse desde cache del navegador (version no cambia con negociaciones/entrevistas). */
describe('CandidatesController.getDetail - cache (R-1)', () => {
  it('responde Cache-Control: no-store y conserva el ETag de la version', async () => {
    const detail = {
      id: 'c1', vacancyId: 'v1', fullName: 'Ana', documentType: 'DNI', documentNumber: '12345678',
      stage: 'DECISION', processState: 'EN_NEGOCIACION', version: 4, createdAt: new Date(), updatedAt: new Date(),
      negotiations: [], interviews: [], isRestrictedView: false,
    };
    const handler = { execute: jest.fn().mockResolvedValue(detail) };
    const controller = new CandidatesController(handler as never, ...(Array(10).fill({}) as [never]));
    const headers: Record<string, string> = {};
    const res = { setHeader: (k: string, v: string) => { headers[k] = v; } };
    await controller.getDetail({ firebaseUid: 'u' } as never, 'c1', { companyId: 'a', branchId: 'b' } as never, res as never);
    expect(headers['Cache-Control']).toBe('no-store');
    expect(headers['ETag']).toBe('"4"');
  });
});
