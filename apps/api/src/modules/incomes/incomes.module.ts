import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { OrganizationsModule } from '../organizations/organizations.module';
import { SequencesModule } from '../sequences/sequences.module';
import { IncomeBalanceImportService } from './income-balance-import.service';
import { IncomeReceiptPdfService } from './income-receipt-pdf.service';
import { Income, IncomeSchema } from './income.schema';
import { IncomesController } from './incomes.controller';
import { IncomesRepository } from './incomes.repository';
import { IncomesService } from './incomes.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Income.name, schema: IncomeSchema }]), OrganizationsModule, SequencesModule],
  controllers: [IncomesController],
  providers: [IncomesRepository, IncomesService, IncomeBalanceImportService, IncomeReceiptPdfService],
  exports: [IncomesRepository, IncomesService]
})
export class IncomesModule {}
