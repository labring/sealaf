import { Module } from '@nestjs/common'
import { InitializerService } from './initializer.service'

@Module({
  providers: [InitializerService],
})
export class InitializerModule {}
