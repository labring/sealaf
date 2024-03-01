import { Module } from '@nestjs/common'
import { CloudBinBucketService } from './cloud-bin-bucket.service'

@Module({
  providers: [
    CloudBinBucketService,
  ],
  exports: [CloudBinBucketService],
})
export class StorageModule {}
