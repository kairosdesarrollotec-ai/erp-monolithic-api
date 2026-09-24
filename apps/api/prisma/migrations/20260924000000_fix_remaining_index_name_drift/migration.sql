-- Seguimiento de revalidacion de PR#7 (comentario sobre a6cb090): quedaban
-- 4 indices/constraints con nombre truncado distinto al que genera Prisma
-- (drift detectado por el gate de migraciones). A diferencia del fix
-- anterior (a6cb090, que edito in-place la migracion ya aplicada de
-- dashboard_items - senalado como riesgo Alto en la revision), esta
-- migracion es forward-only: solo renombra los indices/constraints ya
-- existentes, sin tocar ninguna migracion previamente aplicada.
--
-- Mismo criterio de sin-red-a-binaries.prisma.sh que el resto de
-- migraciones manuales de este proyecto: correr en un entorno con red
-- completa antes de mergear (npx prisma generate / npx prisma migrate dev)
-- para que Prisma re-valide/re-genere esto oficialmente si hace falta.

-- notification_template_versions: @@unique([organizationId, eventType, version])
ALTER INDEX "notification_template_versions_organization_id_event_type__key"
  RENAME TO "notification_template_versions_organization_id_event_type_v_key";

-- notifications_read_model: @@index([recipientFirebaseUid, readAt, createdAt])
ALTER INDEX "notifications_read_model_recipient_firebase_uid_read_at_c_idx"
  RENAME TO "notifications_read_model_recipient_firebase_uid_read_at_cre_idx";

-- reservation_deposit_policy_versions: @@unique([organizationId, version])
ALTER INDEX "reservation_deposit_policy_versions_organization_id_versio_key"
  RENAME TO "reservation_deposit_policy_versions_organization_id_version_key";

-- role_permission_matrix_versions: @@unique([organizationId, version, role, action])
ALTER INDEX "role_permission_matrix_versions_organization_id_version_ro_key"
  RENAME TO "role_permission_matrix_versions_organization_id_version_rol_key";
