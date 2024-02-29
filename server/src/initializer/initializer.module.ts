import { Module } from '@nestjs/common'
import { RegionService } from 'src/region/region.service'
import { InitializerService } from './initializer.service'

@Module({
  providers: [InitializerService, RegionService],
})
export class InitializerModule {}
