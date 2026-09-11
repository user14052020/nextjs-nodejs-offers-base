import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ClientsModule } from '../clients/clients.module';
import { IncomesModule } from '../incomes/incomes.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { Work, WorkSchema } from './work.schema';
import { WorkUpdPdfService } from './work-upd-pdf.service';
import { WorksController } from './works.controller';
import { WorksRepository } from './works.repository';
import { WorksService } from './works.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Work.name, schema: WorkSchema }]),
    OrganizationsModule,
    ClientsModule,
    IncomesModule
  ],
  controllers: [WorksController],
  providers: [WorksRepository, WorksService, WorkUpdPdfService]
})
export class WorksModule {}
