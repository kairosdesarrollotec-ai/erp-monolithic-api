export class CompleteDeliveryCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    /**
     * @deprecated ya no se usan para validar BR-INS-003/004 (eso ahora lo
     * hace el conteo real de RentalEvidence) - se conservan solo para
     * registrarlos en el evento de auditoria durante la transicion, por si
     * algun cliente viejo aun los envia.
     */
    public readonly photosCount?: number,
    public readonly videosCount?: number,
    public readonly notes?: string,
  ) {}
}
