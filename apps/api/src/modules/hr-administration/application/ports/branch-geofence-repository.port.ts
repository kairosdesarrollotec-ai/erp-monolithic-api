export interface BranchGeofenceRecord {
  branchId: string;
  branchName: string;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}

/** 22-oct (#9): geocerca (coordenada + radio) de cada sede, usada para validar las marcas de asistencia propias. */
export abstract class BranchGeofenceRepositoryPort {
  abstract find(companyId: string, branchId: string): Promise<BranchGeofenceRecord | null>;
  abstract set(
    companyId: string,
    branchId: string,
    data: { latitude: number; longitude: number; radiusMeters: number; updatedBy: string; updatedAt: Date },
  ): Promise<BranchGeofenceRecord | null>;
  abstract clear(
    companyId: string,
    branchId: string,
    data: { updatedBy: string; updatedAt: Date },
  ): Promise<BranchGeofenceRecord | null>;
}
