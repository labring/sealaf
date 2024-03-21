import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ServerConfig } from '../constants'
import { UserModule } from '../user/user.module'
import { JwtStrategy } from './jwt.strategy'
import { HttpModule } from '@nestjs/axios'
import { PatService } from 'src/user/pat.service'
import { AuthenticationService } from './authentication.service'
import { AuthenticationController } from './authentication.controller'
import { SealosManagerGuard } from './sealos-manager.guard'

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: ServerConfig.JWT_SECRET,
      signOptions: { expiresIn: ServerConfig.JWT_EXPIRES_IN },
    }),
    UserModule,
    HttpModule,
  ],
  providers: [
    JwtStrategy,
    PatService,
    AuthenticationService,
    SealosManagerGuard,
  ],
  controllers: [AuthenticationController],
})
export class AuthenticationModule {}
