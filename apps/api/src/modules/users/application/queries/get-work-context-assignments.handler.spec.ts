import { GetWorkContextAssignmentsHandler } from './get-work-context-assignments.handler';
import { GetWorkContextAssignmentsQuery } from './get-work-context-assignments.query';
import { WorkContextRepositoryPort } from '../ports/work-context-repository.port';

describe('GetWorkContextAssignmentsHandler', () => {
  it('devuelve las asignaciones del repositorio tal cual, sin filtrarlas', async () => {
    const assignments = [
      { companyId: 'c1', companyName: 'VeloxRent', branchId: 'b1', branchName: 'Ayacucho — Sede Central' },
      { companyId: 'c2', companyName: 'Casa del Auto', branchId: 'b2', branchName: 'Lima — Sede Norte' },
    ];
    const repository: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn().mockResolvedValue(assignments),
      findValidAssignment: jest.fn(),
    };
    const handler = new GetWorkContextAssignmentsHandler(repository);

    const result = await handler.execute(new GetWorkContextAssignmentsQuery('uid-1'));

    expect(repository.findAssignmentsByFirebaseUid).toHaveBeenCalledWith('uid-1');
    expect(result).toEqual(assignments);
  });

  it('devuelve una lista vacia si el usuario no tiene asignaciones', async () => {
    const repository: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn().mockResolvedValue([]),
      findValidAssignment: jest.fn(),
    };
    const handler = new GetWorkContextAssignmentsHandler(repository);

    const result = await handler.execute(new GetWorkContextAssignmentsQuery('uid-sin-asignaciones'));

    expect(result).toEqual([]);
  });
});
