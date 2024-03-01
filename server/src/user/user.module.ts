import { Module } from '@nestjs/common'
import { UserService } from './user.service'
import { PatService } from './pat.service'
import { PatController } from './pat.controller'
import { UserController } from './user.controller'
import { ApplicationService } from 'src/application/application.service'

@Module({
  providers: [
    UserService,
    PatService,
    ApplicationService,
  ],
  exports: [UserService],
  controllers: [PatController, UserController],
})
export class UserModule {}
