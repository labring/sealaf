import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, Length } from 'class-validator'

export class SigninDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  kubeconfig: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  username: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  namespace: string
}
