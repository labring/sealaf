import { AuthenticationService } from './authentication.service'
import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ApiResponseString, ResponseUtil } from 'src/utils/response'

import { Pat2TokenDto } from './dto/pat2token.dto'
import { ClusterService } from 'src/region/cluster/cluster.service'
import { UserService } from 'src/user/user.service'
import { SigninDto } from './dto/signin.dto'
import { User } from 'src/user/entities/user'

@ApiTags('Authentication')
@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly clusterService: ClusterService,
    private readonly userService: UserService,
  ) {}

  @ApiOperation({ summary: 'Signin by kubeconfig' })
  @ApiResponse({ type: ResponseUtil })
  @Post('signin')
  async signin(@Body() dto: SigninDto) {
    const user = new User()
    user.kubeconfig = dto.kubeconfig
    user.username = dto.username
    user.namespace = dto.namespace

    const api = this.clusterService.makeCoreV1Api(user)
    try {
      await api.readNamespace(user.namespace)
    } catch (e) {
      return ResponseUtil.error('validate user failed')
    }
    let _user = await this.userService.findOneByNamespace(user.namespace)
    if (!_user) {
      _user = await this.userService.create(user)
      // eslint-disable-next-line
      await this.clusterService.createStorageUser(user).catch(() => {})
    }
    const token = this.authService.getAccessTokenByUser(_user)
    return ResponseUtil.ok({ token, user })
  }

  /**
   * Get user token by PAT
   * @param pat
   * @returns
   */
  @ApiOperation({ summary: 'Get user token by PAT' })
  @ApiResponseString()
  @Post('pat2token')
  async pat2token(@Body() dto: Pat2TokenDto) {
    const token = await this.authService.pat2token(dto.pat)
    if (!token) {
      return ResponseUtil.error('invalid pat')
    }

    return ResponseUtil.ok(token)
  }
}
