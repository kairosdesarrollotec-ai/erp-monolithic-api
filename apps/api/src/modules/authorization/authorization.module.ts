import { Module } from '@nestjs/common';
import { MatrixAuthorizationService } from './matrix-authorization.service';
import { RolePermissionMatrixPort } from '../admin/application/ports/role-permission-matrix.port';
import { PrismaRolePermissionMatrixRepository } from '../admin/infrastructure/persistence/prisma-role-permission-matrix.repository';

@Module({
  providers: [
    MatrixAuthorizationService,
    { provide: RolePermissionMatrixPort, useClass: PrismaRolePermissionMatrixRepository },
  ],
  exports: [MatrixAuthorizationService, RolePermissionMatrixPort],
})
export class AuthorizationModule {}
