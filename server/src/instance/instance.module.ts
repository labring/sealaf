import { Module } from '@nestjs/common'
import { InstanceService } from './instance.service'
import { InstanceTaskService } from './instance-task.service'
import { StorageModule } from '../storage/storage.module'
import { DatabaseModule } from '../database/database.module'
import { ApplicationModule } from 'src/application/application.module'

@Module({
  imports: [StorageModule, DatabaseModule, ApplicationModule],
  providers: [InstanceService, InstanceTaskService],
})
export class InstanceModule {}
