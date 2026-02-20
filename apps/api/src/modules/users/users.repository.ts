import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';

import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersRepository {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async count(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async create(user: Pick<User, 'username' | 'passwordHash' | 'role'>): Promise<UserDocument> {
    return this.userModel.create(user);
  }

  async updatePasswordById(id: string, passwordHash: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, { passwordHash }, { new: true }).exec();
  }
}
