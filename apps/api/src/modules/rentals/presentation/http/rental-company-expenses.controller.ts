import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  AuthenticatedRequest,
  FirebaseAuthGuard,
} from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RecordCompanyExpenseHandler } from '../../application/commands/record-company-expense.handler';
import { RecordCompanyExpenseCommand } from '../../application/commands/record-company-expense.command';
import {
  CompanyExpenseResponse,
  RecordCompanyExpenseDto,
} from './dto/record-company-expense.dto';

@Controller('rentals')
@UseGuards(FirebaseAuthGuard)
export class RentalCompanyExpensesController {
  constructor(
    private readonly recordCompanyExpenseHandler: RecordCompanyExpenseHandler,
  ) {}

  @Post(':id/company-expenses')
  @HttpCode(201)
  @UseInterceptors(IdempotencyInterceptor)
  async recordCompanyExpense(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordCompanyExpenseDto,
  ): Promise<CompanyExpenseResponse> {
    return this.recordCompanyExpenseHandler.execute(
      new RecordCompanyExpenseCommand(
        req.firebaseUid!,
        id,
        dto.companyId,
        dto.branchId,
        dto.expenseType,
        dto.amount,
        dto.expenseDate,
        dto.reference,
        dto.currency,
        dto.notes,
        dto.paidByCustomer,
      ),
    );
  }
}
