import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { FilesModule } from '../files/files.module';
import { Organization, OrganizationSchema } from './organization.schema';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsRepository } from './organizations.repository';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Organization.name, schema: OrganizationSchema }]), FilesModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsRepository, OrganizationsService],
  exports: [OrganizationsService]
})
export class OrganizationsModule {}
