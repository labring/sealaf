import { Module } from '@nestjs/common'
import { CollectionService } from './collection/collection.service'
import { CollectionController } from './collection/collection.controller'
import { MongoService } from './mongo.service'
import { ApplicationService } from 'src/application/application.service'
import { BundleService } from 'src/application/bundle.service'
import { SettingService } from 'src/setting/setting.service'
import { DedicatedDatabaseService } from './dedicated-database/dedicated-database.service'
import { DedicatedDatabaseTaskService } from './dedicated-database/dedicated-database-task.service'
import { HttpModule } from '@nestjs/axios'
import { ApplicationListener } from './listeners/application.listener'
import { DedicatedDatabaseMonitorService } from './monitor/monitor.service'
import { DedicatedDatabaseMonitorController } from './monitor/monitor.controller'

@Module({
  imports: [HttpModule],
  controllers: [
    CollectionController,
    DedicatedDatabaseMonitorController,
  ],
  providers: [
    CollectionService,
    MongoService,
    ApplicationService,
    BundleService,
    SettingService,
    DedicatedDatabaseService,
    DedicatedDatabaseTaskService,
    DedicatedDatabaseMonitorService,
    ApplicationListener,
  ],
  exports: [
    CollectionService,
    MongoService,
    DedicatedDatabaseService,
  ],
})
export class DatabaseModule {}
