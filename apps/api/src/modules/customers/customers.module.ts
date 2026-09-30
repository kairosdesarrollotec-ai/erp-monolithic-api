import { Module } from '@nestjs/common';
import { CustomersController } from './presentation/http/customers.controller';
import { CreateCustomerHandler } from './application/commands/create-customer.handler';
import { UpdateCustomerHandler } from './application/commands/update-customer.handler';
import { ListCustomersHandler } from './application/queries/list-customers.handler';
import { GetCustomerHandler } from './application/queries/get-customer.handler';
import { CustomerRepositoryPort } from './application/ports/customer-repository.port';
import { PrismaCustomerRepository } from './infrastructure/persistence/prisma-customer.repository';
import { UsersModule } from '../users/users.module';
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
  imports: [UsersModule, AuthorizationModule],
  controllers: [CustomersController],
  providers: [
    CreateCustomerHandler,
    UpdateCustomerHandler,
    ListCustomersHandler,
    GetCustomerHandler,
    { provide: CustomerRepositoryPort, useClass: PrismaCustomerRepository },
  ],
  exports: [CustomerRepositoryPort],
})
export class CustomersModule {}
