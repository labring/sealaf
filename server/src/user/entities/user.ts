import { ApiProperty } from '@nestjs/swagger'
import { ObjectId } from 'mongodb'

export class User {
  @ApiProperty({ type: String })
  _id?: ObjectId

  @ApiProperty()
  username: string

  @ApiProperty()
  namespace: string

  @ApiProperty()
  kubeconfig: string

  @ApiProperty()
  createdAt: Date

  @ApiProperty()
  updatedAt: Date
}
