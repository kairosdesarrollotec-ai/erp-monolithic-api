import { GetMyProfileHandler } from './get-my-profile.handler';
import { GetMyProfileQuery } from './get-my-profile.query';
import { UserProfileRepositoryPort } from '../ports/user-profile-repository.port';
import { WorkContextRepositoryPort } from '../ports/work-context-repository.port';

describe('GetMyProfileHandler', () => {
  let userProfileRepo: jest.Mocked<UserProfileRepositoryPort>;
  let workContextRepo: jest.Mocked<WorkContextRepositoryPort>;
  let handler: GetMyProfileHandler;

  beforeEach(() => {
    userProfileRepo = {
      findByFirebaseUid: jest.fn(),
      createProfile: jest.fn(),
      completeActivation: jest.fn(),
    };

    workContextRepo = {
      findAssignmentsByFirebaseUid: jest.fn(),
      findValidAssignment: jest.fn(),
    };

    handler = new GetMyProfileHandler(userProfileRepo, workContextRepo);
  });

  it('devuelve el perfil consolidado cuando existe UserProfile y tiene asignaciones', async () => {
    const mfaDate = new Date('2026-03-15T12:00:00.000Z');
    userProfileRepo.findByFirebaseUid.mockResolvedValue({
      id: 'profile-1',
      organizationId: 'org-principal',
      firebaseUid: 'uid-123',
      requiresPasswordChange: true,
      mfaEnrolledAt: mfaDate,
    });

    const mockAssignments = [
      {
        companyId: 'comp-1',
        companyName: 'VeloxRent',
        branchId: 'branch-1',
        branchName: 'Sede Central',
        role: { id: 'r1', name: 'Administrador', key: 'ADMIN' },
      },
    ];
    workContextRepo.findAssignmentsByFirebaseUid.mockResolvedValue(mockAssignments);

    const query = new GetMyProfileQuery('uid-123', 'admin@kairos.local', 'Admin User');
    const result = await handler.execute(query);

    expect(userProfileRepo.findByFirebaseUid).toHaveBeenCalledWith('uid-123');
    expect(workContextRepo.findAssignmentsByFirebaseUid).toHaveBeenCalledWith('uid-123');
    expect(result).toEqual({
      firebaseUid: 'uid-123',
      email: 'admin@kairos.local',
      displayName: 'Admin User',
      organizationId: 'org-principal',
      requiresPasswordChange: true,
      mfaEnrolled: true,
      mfaEnrolledAt: mfaDate.toISOString(),
      assignments: mockAssignments,
    });
  });

  describe('comportamiento cuando el UserProfile es null', () => {
    it('usa organizationId de las asignaciones como fallback cuando existe', async () => {
      userProfileRepo.findByFirebaseUid.mockResolvedValue(null);
      const mockAssignments = [
        {
          companyId: 'comp-1',
          companyName: 'VeloxRent',
          branchId: 'branch-1',
          branchName: 'Sede Central',
          role: { id: 'r1', name: 'Front Office', key: 'FRONT_OFFICE' },
          organizationId: 'org-from-assignment',
        },
      ];
      workContextRepo.findAssignmentsByFirebaseUid.mockResolvedValue(mockAssignments);

      const query = new GetMyProfileQuery('uid-sin-perfil', 'operador@kairos.local', null);
      const result = await handler.execute(query);

      expect(result).toEqual({
        firebaseUid: 'uid-sin-perfil',
        email: 'operador@kairos.local',
        displayName: null,
        organizationId: 'org-from-assignment',
        requiresPasswordChange: false,
        mfaEnrolled: false,
        mfaEnrolledAt: null,
        assignments: mockAssignments,
      });
    });

    it('hace fallback de organizationId a string vacio si no hay asignaciones ni perfil', async () => {
      userProfileRepo.findByFirebaseUid.mockResolvedValue(null);
      workContextRepo.findAssignmentsByFirebaseUid.mockResolvedValue([]);

      const query = new GetMyProfileQuery('uid-vacio');
      const result = await handler.execute(query);

      expect(result).toEqual({
        firebaseUid: 'uid-vacio',
        email: null,
        displayName: null,
        organizationId: '',
        requiresPasswordChange: false,
        mfaEnrolled: false,
        mfaEnrolledAt: null,
        assignments: [],
      });
    });
  });

  describe('MFA enrolled vs not enrolled', () => {
    it('marca mfaEnrolled: false y mfaEnrolledAt: null cuando mfaEnrolledAt es null', async () => {
      userProfileRepo.findByFirebaseUid.mockResolvedValue({
        id: 'profile-2',
        organizationId: 'org-1',
        firebaseUid: 'uid-no-mfa',
        requiresPasswordChange: false,
        mfaEnrolledAt: null,
      });
      workContextRepo.findAssignmentsByFirebaseUid.mockResolvedValue([]);

      const query = new GetMyProfileQuery('uid-no-mfa', 'nomfa@kairos.local', 'No MFA');
      const result = await handler.execute(query);

      expect(result.mfaEnrolled).toBe(false);
      expect(result.mfaEnrolledAt).toBeNull();
    });

    it('marca mfaEnrolled: true y formatea mfaEnrolledAt cuando mfaEnrolledAt tiene fecha', async () => {
      const enrollmentDate = new Date('2026-02-20T08:30:00.000Z');
      userProfileRepo.findByFirebaseUid.mockResolvedValue({
        id: 'profile-3',
        organizationId: 'org-1',
        firebaseUid: 'uid-mfa',
        requiresPasswordChange: false,
        mfaEnrolledAt: enrollmentDate,
      });
      workContextRepo.findAssignmentsByFirebaseUid.mockResolvedValue([]);

      const query = new GetMyProfileQuery('uid-mfa', 'mfa@kairos.local', 'MFA User');
      const result = await handler.execute(query);

      expect(result.mfaEnrolled).toBe(true);
      expect(result.mfaEnrolledAt).toBe(enrollmentDate.toISOString());
    });
  });
});
