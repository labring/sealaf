import { Injectable } from '@nestjs/common'
import { SystemDatabase } from 'src/system-database'
import { User } from './entities/user'
import { ObjectId } from 'mongodb'

@Injectable()
export class UserService {
  private readonly db = SystemDatabase.db

  async create(data: Partial<User>) {
    const res = await this.db.collection<User>('User').insertOne({
      username: data.username,
      namespace: data.namespace,
      kubeconfig: data.kubeconfig,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return await this.findOneById(res.insertedId)
  }

  async findOneById(id: ObjectId) {
    return this.db
      .collection<User>('User')
      .findOne({
        _id: id
      })
  }

  async findOneByNamespace(namespace: string) {
    return this.db.collection<User>('User').findOne({ namespace })
  }

  async updateUser(id: ObjectId, data: Partial<User>) {
    await this.db
      .collection<User>('User')
      .updateOne({ _id: id }, { $set: data })

    return await this.findOneById(id)
  }
}
