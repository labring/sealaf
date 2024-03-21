import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext) {
    const res = await super.canActivate(context)
    if (!res) {
      return false
    }
    const request = context.switchToHttp().getRequest()
    const kubeconfig = request.headers?.['credential']
    if (kubeconfig) {
      request.user.kubeconfig = Buffer.from(kubeconfig, 'base64').toString(
        'utf-8',
      )
    }
    return true
  }
}
