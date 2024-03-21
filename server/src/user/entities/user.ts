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
  createdAt: Date

  @ApiProperty()
  updatedAt: Date
}

export class UserWithKubeconfig extends User {
  @ApiProperty()
  kubeconfig: string
}
