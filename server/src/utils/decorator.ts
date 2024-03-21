import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const InjectUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const kubeconfig = request.headers?.['credential']
    if (kubeconfig) {
      request.user.kubeconfig = Buffer.from(kubeconfig, 'base64').toString(
        'utf-8',
      )
    }
    return request.user
  },
)

export const InjectApplication = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    return request.application
  },
)
