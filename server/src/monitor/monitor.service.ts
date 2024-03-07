import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { ServerConfig } from 'src/constants'
import { ClusterService } from 'src/region/cluster/cluster.service'
import { User } from 'src/user/entities/user'

const requestConfig = {
  retryAttempts: 5,
  retryDelayBase: 300,
  rateAccuracy: '1m',
}

export enum MonitorMetric {
  cpu = 'cpu',
  memory = 'memory',
}

@Injectable()
export class MonitorService {
  constructor(
    private readonly httpService: HttpService,
    private readonly clusterService: ClusterService
  ) { }
  private readonly logger = new Logger(MonitorService.name)

  async getData(
    appid: string,
    metrics: MonitorMetric[],
    isRange: boolean,
  ) {
    const endpoint = ServerConfig.APP_MONITOR_URL
    if (!endpoint) {
      this.logger.warn('Metrics not available for no endpoint')
      return {}
    }
    const user = await this.clusterService.getUserByAppid(appid)

    const data = {}
    const res = metrics.map(async (metric) => {
      data[metric] =
        !isRange
          ? await this.query(endpoint, appid, metric, user)
          : await this.queryRange(endpoint, appid, metric, user)
    })

    await Promise.all(res)
    return data
  }

  private async query(endpoint: string, appid: string, type: string, user: User) {
    const query = {
      type,
      launchPadName: `sealaf-${appid}`,
    }
    return await this.queryInternal(endpoint, query, user)
  }

  private async queryRange(
    endpoint: string,
    appid: string,
    type: string,
    user: User
  ) {
    const range = 3600 // 1 hour
    const now = Math.floor(Date.now() / 1000)
    const start = now - range
    const end = now

    const queryParams = {
      step: '1m',
      start,
      end,
    }

    return await this.queryInternal(endpoint, {
      type,
      launchPadName: `sealaf-${appid}`,
      ...queryParams,
    }, user)
  }

  private async queryInternal(
    endpoint: string,
    query: Record<string, string | number>,
    user: User
  ) {
    for (let attempt = 1; attempt <= requestConfig.retryAttempts; attempt++) {
      try {
        const res = await this.httpService
          .get(endpoint, {
            params: {
              ...query,
              namespace: user.namespace
            },
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': encodeURIComponent(user.kubeconfig)
            },
          })
          .toPromise()

        return res.data.data.result
      } catch (error) {
        if (attempt >= requestConfig.retryAttempts) {
          this.logger.error('Metrics not available', error.message)
          return []
        }

        await new Promise((resolve) =>
          setTimeout(resolve, attempt * requestConfig.retryDelayBase),
        )
      }
    }
  }
}
