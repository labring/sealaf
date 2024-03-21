import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common'
import { ClusterService } from 'src/region/cluster/cluster.service'
import { UserWithKubeconfig } from 'src/user/entities/user'
import { IRequest } from 'src/utils/interface'

@Injectable()
export class SealosManagerGuard implements CanActivate {
  private readonly logger = new Logger(SealosManagerGuard.name)
  constructor(private readonly clusterService: ClusterService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest() as IRequest
    const user = request.user as UserWithKubeconfig

    const api = await this.clusterService.makeRbacAuthorizationApi(user)
    const kc = this.clusterService.loadKubeConfig(user)
    const username = kc.users[0].name

    try {
      const res = await api.readNamespacedRoleBinding(username, user.namespace)

      if (['Owner'].includes(res.body.roleRef.name)) {
        return true
      }
    } catch {}

    try {
      const res = await api.readNamespacedRoleBinding(
        'rb-' + username,
        user.namespace,
      )

      if (['Owner', 'Manager'].includes(res.body.roleRef.name)) {
        return true
      }
    } catch {}

    return false
  }
}
