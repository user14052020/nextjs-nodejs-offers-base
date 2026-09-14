import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { HealthModule } from './common/health/health.module';
import { SearchModule } from './common/search/search.module';
import { UploadModule } from './common/upload/upload.module';
import { UowModule } from './common/uow/uow.module';
import { AuthModule } from './modules/auth/auth.module';
import { BackupModule } from './modules/backup/backup.module';
import { ClientsModule } from './modules/clients/clients.module';
import { FilesModule } from './modules/files/files.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { SequencesModule } from './modules/sequences/sequences.module';
import { UsersModule } from './modules/users/users.module';
import { WorksModule } from './modules/works/works.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/offers-base?replicaSet=rs0'),
    UploadModule,
    SearchModule,
    UowModule,
    HealthModule,
    UsersModule,
    AuthModule,
    BackupModule,
    OrganizationsModule,
    ClientsModule,
    FilesModule,
    SequencesModule,
    WorksModule
  ]
})
export class AppModule {}
