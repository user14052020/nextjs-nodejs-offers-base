import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

@Injectable()
export class UnitOfWork {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result as T;
    } finally {
      await session.endSession();
    }
  }
}
