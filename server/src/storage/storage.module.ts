import { Module } from '@nestjs/common'
import { ApplicationService } from 'src/application/application.service'
import { GatewayModule } from 'src/gateway/gateway.module'
import { BundleService } from 'src/application/bundle.service'
import { CloudBinBucketService } from './cloud-bin-bucket.service'

@Module({
  imports: [GatewayModule],
  providers: [
    ApplicationService,
    BundleService,
    CloudBinBucketService,
  ],
  exports: [CloudBinBucketService],
})
export class StorageModule {}
