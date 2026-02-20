import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { FilesModule } from '../files/files.module';
import { Client, ClientSchema } from './client.schema';
import { ClientsController } from './clients.controller';
import { ClientsRepository } from './clients.repository';
import { ClientsService } from './clients.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Client.name, schema: ClientSchema }]), FilesModule],
  controllers: [ClientsController],
  providers: [ClientsRepository, ClientsService],
  exports: [ClientsService]
})
export class ClientsModule {}
