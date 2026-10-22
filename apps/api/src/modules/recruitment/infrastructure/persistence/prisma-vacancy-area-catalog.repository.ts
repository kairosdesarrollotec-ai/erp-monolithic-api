import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { matchAreaInCatalog } from '../../../hr-administration/domain/hr-area-rules';
import { VacancyAreaCatalogPort, VacancyCatalogArea } from '../../application/ports/vacancy-area-catalog.port';

@Injectable()
export class PrismaVacancyAreaCatalogRepository extends VacancyAreaCatalogPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async resolveActive(operatingCompanyId: string, text: string): Promise<VacancyCatalogArea | null> {
    const catalog = await this.prisma.hrArea.findMany({
      where: { operatingCompanyId, isActive: true },
      select: { code: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });
    const match = matchAreaInCatalog(catalog, text);
    return match ? { code: match.code, name: match.name } : null;
  }
}
