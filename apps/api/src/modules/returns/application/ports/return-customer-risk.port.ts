import type { Prisma } from '@prisma/client';
import { CustomerRiskStatus } from '../../domain/customer-risk-status';

/**
 * Semáforo del cliente (Customer.status) como efecto de Devolución (BR-DEV-007/008, TD-DEV-002).
 * Solo avanza NORMAL -> AMBAR -> ROJO. Se ejecuta en la MISMA transacción del comando.
 */
export abstract class ReturnCustomerRiskPort {
  /**
   * Sube el semáforo al estado `target` solo si es más grave que el actual (nunca degrada). `target: 'NORMAL'`
   * equivale a una lectura. Devuelve el estado previo y el resultante.
   */
  abstract escalate(
    input: { customerId: string; operatingCompanyId: string; target: CustomerRiskStatus },
    tx: Prisma.TransactionClient,
  ): Promise<{ previous: CustomerRiskStatus; current: CustomerRiskStatus }>;
}
