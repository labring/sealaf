import { CreateDedicatedDatabaseDto } from '../../database/dto/create-dedicated-database.dto'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator'
import { ApplicationState } from '../entities/application'
import { CreateAutoscalingDto } from './create-autoscaling.dto'
import { Type } from 'class-transformer'

const STATES = [
  ApplicationState.Running,
  ApplicationState.Stopped,
  ApplicationState.Restarting,
]

/**
 * @deprecated use UpdateApplicationNameDto or UpdateApplicationStateDto instead
 */
export class UpdateApplicationDto {
  @ApiPropertyOptional()
  @IsString()
  @Length(1, 64)
  name?: string

  @ApiPropertyOptional({
    enum: ApplicationState,
  })
  @IsIn(STATES)
  state?: ApplicationState

  validate() {
    return null
  }
}

export class UpdateApplicationNameDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  @IsNotEmpty()
  name: string
}

export class UpdateApplicationStateDto {
  @ApiProperty({ enum: ApplicationState })
  @IsIn(STATES)
  @IsNotEmpty()
  state: ApplicationState

  @ApiProperty({
    required: false,
    description: 'Flag for runtime only operations',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  onlyRuntimeFlag?: boolean
}

export class UpdateApplicationBundleDto {
  // build resources
  @ApiProperty({ example: 200 })
  @IsNotEmpty()
  @IsInt()
  cpu: number

  @ApiProperty({ example: 256 })
  @IsNotEmpty()
  @IsInt()
  memory: number

  @ApiProperty({ type: CreateAutoscalingDto })
  @ValidateNested()
  @Type(() => CreateAutoscalingDto)
  autoscaling: CreateAutoscalingDto

  @ApiProperty({ type: CreateDedicatedDatabaseDto })
  @ValidateNested()
  @IsNotEmpty()
  @Type(() => CreateDedicatedDatabaseDto)
  dedicatedDatabase?: CreateDedicatedDatabaseDto

  validate() {
    return null
  }
}
