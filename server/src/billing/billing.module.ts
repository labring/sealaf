import { Module } from '@nestjs/common'
import { BillingService } from './billing.service'
import { ResourceService } from './resource.service'
import { ResourceController } from './resource.controller'

@Module({
  controllers: [ResourceController],
  providers: [BillingService, ResourceService],
  exports: [BillingService, ResourceService],
})
export class BillingModule {}
