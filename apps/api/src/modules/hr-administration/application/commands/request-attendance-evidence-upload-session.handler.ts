import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { AttendanceEvidenceStoragePort } from '../ports/attendance-evidence-storage.port';
import {
  EmployeeNotFoundError,
  EmployeeTerminatedError,
  InvalidAttendanceEvidenceError,
} from '../../domain/hr-administration-errors';
import {
  ATTENDANCE_EVIDENCE_CONTENT_TYPES,
  AttendanceEvidenceContentType,
  MAX_ATTENDANCE_EVIDENCE_BYTES,
} from '../../domain/hr-administration-rules';
import { RequestAttendanceEvidenceUploadSessionCommand } from './request-attendance-evidence-upload-session.command';

/**
 * DEC-ADP-ATT-EVIDENCE-002: URL firmada para subir la foto de asistencia (reloj + hora + rostro). Cada colaborador
 * sube SUS propias fotos: basta que la ficha esté vinculada a su cuenta (por correo) y tenga asignación vigente en
 * la sede; el personal con LOG_ATTENDANCE también puede pedirla para cualquier colaborador de su alcance.
 * El `storageRef` devuelto es el que se envía en `evidence.storageRef` de `log-attendance`.
 */
@Injectable()
export class RequestAttendanceEvidenceUploadSessionHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly employees: EmployeeRepositoryPort,
    private readonly storage: AttendanceEvidenceStoragePort,
  ) {}

  async execute(
    command: RequestAttendanceEvidenceUploadSessionCommand,
  ): Promise<{ uploadUrl: string; objectUrl: string; storageRef: string; expiresAt: Date }> {
    const employee = await this.employees.findById(command.employeeId);
    if (!employee) {
      throw new EmployeeNotFoundError(command.employeeId);
    }

    const scope = {
      firebaseUid: command.firebaseUid,
      companyId: employee.operatingCompanyId,
      branchId: employee.branchId,
    };
    if (employee.firebaseUid && employee.firebaseUid === command.firebaseUid) {
      await this.workContext.authorize(scope);
    } else {
      await this.access.authorize(scope, 'LOG_ATTENDANCE');
    }

    if (employee.status === 'TERMINADO') {
      throw new EmployeeTerminatedError(employee.id);
    }
    if (!(ATTENDANCE_EVIDENCE_CONTENT_TYPES as readonly string[]).includes(command.contentType)) {
      throw new InvalidAttendanceEvidenceError(
        `Tipo de archivo no admitido (${command.contentType}). Sube una foto JPG, PNG o WEBP.`,
      );
    }
    if (command.contentLength > MAX_ATTENDANCE_EVIDENCE_BYTES) {
      throw new InvalidAttendanceEvidenceError(
        `La foto supera el tamaño máximo de ${Math.round(MAX_ATTENDANCE_EVIDENCE_BYTES / (1024 * 1024))} MB.`,
      );
    }

    return this.storage.generateSignedUploadUrl({
      companyId: employee.operatingCompanyId,
      employeeId: employee.id,
      contentType: command.contentType as AttendanceEvidenceContentType,
    });
  }
}
