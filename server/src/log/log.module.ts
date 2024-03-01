import { Module } from '@nestjs/common'
import { FunctionModule } from 'src/function/function.module'
import { ApplicationModule } from '../application/application.module'
import { LogController } from './log.controller'

@Module({
  imports: [ApplicationModule, FunctionModule],
  controllers: [LogController],
})
export class LogModule {}
