import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { CandidateRecord, CandidateRepositoryPort } from '../ports/candidate-repository.port';
import { CandidateDocumentDuplicateError, VacancyNotFoundError } from '../../domain/recruitment-errors';
import { RegisterCandidateCommand } from './register-candidate.command';

@Injectable()
export class RegisterCandidateHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly vacancies: VacancyRepositoryPort,
    private readonly candidates: CandidateRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RegisterCandidateCommand): Promise<CandidateRecord> {
    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'REGISTER_CANDIDATE',
    );

    return this.transactionManager.run(async (tx) => {
      const vacancy = await this.vacancies.findById(command.vacancyId, scope, tx);
      if (!vacancy) {
        throw new VacancyNotFoundError(command.vacancyId);
      }

      const existingCandidate = await this.candidates.findByDocumentNumber(
        command.vacancyId,
        command.documentNumber.trim(),
        tx,
      );
      if (existingCandidate) {
        throw new CandidateDocumentDuplicateError(command.documentNumber.trim());
      }

      const created = await this.candidates.create(
        {
          vacancyId: command.vacancyId,
          fullName: command.fullName.trim(),
          documentType: command.documentType,
          documentNumber: command.documentNumber.trim(),
          email: command.email?.trim() || null,
          phone: command.phone?.trim() || null,
          cvDocumentId: command.cvDocumentId,
          salaryExpectation: command.salaryExpectation ?? null,
        },
        tx,
      );

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'candidate',
          entityId: created.id,
          action: 'CANDIDATE_REGISTERED',
          changes: {
            vacancyId: created.vacancyId,
            fullName: created.fullName,
            documentNumber: created.documentNumber,
            stage: created.stage,
          },
        },
        tx,
      );

      return created;
    });
  }
}
