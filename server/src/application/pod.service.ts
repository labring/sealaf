import { V1Pod, V1PodList } from '@kubernetes/client-node'
import { Injectable, Logger } from '@nestjs/common'
import { ClusterService } from 'src/region/cluster/cluster.service'
import http from 'http'
import { PodNameListDto, ContainerNameListDto } from './dto/pod.dto'
import { LABEL_KEY_APP_ID } from 'src/constants'
import { UserWithKubeconfig } from 'src/user/entities/user'

@Injectable()
export class PodService {
  private readonly logger = new Logger(PodService.name)

  constructor(private readonly cluster: ClusterService) {}
  async getPodNameListByAppid(user: UserWithKubeconfig, appid: string) {
    const coreV1Api = this.cluster.makeCoreV1Api(user)
    const res: { response: http.IncomingMessage; body: V1PodList } =
      await coreV1Api.listNamespacedPod(
        user.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `${LABEL_KEY_APP_ID}=${appid}`,
      )
    const podNames: PodNameListDto = { appid: appid, podNameList: [] }
    for (const item of res.body.items) {
      podNames.podNameList.push(item.metadata.name)
    }
    return podNames
  }

  async getContainerNameListByPodName(
    user: UserWithKubeconfig,
    podName: string,
  ) {
    const coreV1Api = this.cluster.makeCoreV1Api(user)

    const res: { response: http.IncomingMessage; body: V1Pod } =
      await coreV1Api.readNamespacedPod(podName, user.namespace)

    const containerNameList =
      res.body.spec.containers?.map((container) => container.name) || []

    const containerNames: ContainerNameListDto = {
      podName: podName,
      containerNameList: containerNameList,
    }

    return containerNames
  }
}
