import { Injectable } from '@nestjs/common';
import { TemplateRecord, TemplateRepositoryPort } from '../../../templates/application/ports/template-repository.port';
import {
  ContractVariant,
  GENERIC_CONTRACT_TEMPLATE_TYPE,
  contractTemplateTypeFor,
} from '../../domain/contract-variant';

export interface ResolvedContractTemplate {
  template: TemplateRecord | null;
  /** Tipo de plantilla buscado primero (el de la combinacion, o el generico). */
  requestedType: string;
  /** true si no habia plantilla vigente para la combinacion y se uso la generica. */
  fallbackUsed: boolean;
}

/**
 * BR-DOC-002/003 - elige la plantilla de contrato vigente para una
 * combinacion (titular natural/juridica x con/sin conductor).
 *
 * - Con combinacion: busca la plantilla ACTIVE de ese tipo; si la empresa aun
 *   no la tiene cargada, cae a la plantilla generica `RENTAL_CONTRACT` (la
 *   unica que existia antes de esta seleccion) para no bloquear la
 *   formalizacion, y lo indica en `fallbackUsed`.
 * - Sin combinacion (clientes antiguos): solo la generica.
 */
@Injectable()
export class ContractTemplateResolver {
  constructor(private readonly templates: TemplateRepositoryPort) {}

  async resolve(
    companyId: string,
    organizationId: string,
    variant?: ContractVariant,
  ): Promise<ResolvedContractTemplate> {
    if (!variant) {
      const generic = await this.templates.findActive(companyId, GENERIC_CONTRACT_TEMPLATE_TYPE, organizationId);
      return { template: generic, requestedType: GENERIC_CONTRACT_TEMPLATE_TYPE, fallbackUsed: false };
    }
    const requestedType = contractTemplateTypeFor(variant);
    const specific = await this.templates.findActive(companyId, requestedType, organizationId);
    if (specific) return { template: specific, requestedType, fallbackUsed: false };
    const generic = await this.templates.findActive(companyId, GENERIC_CONTRACT_TEMPLATE_TYPE, organizationId);
    return { template: generic, requestedType, fallbackUsed: generic !== null };
  }
}
