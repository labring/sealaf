import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { IRequest } from 'src/utils/interface'
import { ApiResponseObject, ResponseUtil } from 'src/utils/response'
import { JwtAuthGuard } from 'src/authentication/jwt.auth.guard'
import { User } from './entities/user'

@ApiTags('User')
@ApiBearerAuth('Authorization')
@Controller('user')
export class UserController {
  constructor() {}

  /**
   * Get current user profile
   * @param request
   * @returns
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiResponseObject(User)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth('Authorization')
  async getProfile(@Req() request: IRequest) {
    const user = request.user
    return ResponseUtil.ok(user)
  }
}
