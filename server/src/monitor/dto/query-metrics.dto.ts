import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsEnum, IsIn, IsString } from 'class-validator'
import { MonitorMetric } from '../monitor.service'

export class QueryMetricsDto {
  @ApiProperty({ isArray: true, enum: MonitorMetric })
  @IsEnum(MonitorMetric, { each: true })
  @IsArray()
  q: MonitorMetric[]

  @ApiProperty({
    description: 'Query type',
    enum: ['range', 'instant'],
  })
  @IsString()
  @IsIn(['range', 'instant'])
  type: 'range' | 'instant'
}
