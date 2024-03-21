import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { MonitorService } from './monitor.service'
import { ResponseUtil } from 'src/utils/response'
import { JwtAuthGuard } from 'src/authentication/jwt.auth.guard'
import { ApplicationAuthGuard } from 'src/authentication/application.auth.guard'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { QueryMetricsDto } from './dto/query-metrics.dto'
import { InjectUser } from 'src/utils/decorator'
import { UserWithKubeconfig } from 'src/user/entities/user'

@ApiTags('Monitor')
@ApiBearerAuth('Authorization')
@Controller('monitor')
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @ApiOperation({ summary: 'Get monitor metrics data' })
  @ApiResponse({ type: ResponseUtil })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get(':appid/metrics')
  async getData(
    @Param('appid') appid: string,
    @Query() dto: QueryMetricsDto,
    @InjectUser() user: UserWithKubeconfig,
  ) {
    const { q: metrics, type } = dto
    const isRange = type === 'range'

    const res = await this.monitorService.getData(user, appid, metrics, isRange)

    return ResponseUtil.ok(res)
  }
}
