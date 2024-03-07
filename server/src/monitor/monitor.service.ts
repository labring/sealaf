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

export const getQuery =
  ({ rateAccuracy }: { rateAccuracy: string }) =>
    (opts: Record<string, unknown>, metric: MonitorMetric) => {
      switch (metric) {
        case MonitorMetric.cpuUsage:
          return {
            instant: false,
            query: `sum(rate(container_cpu_usage_seconds_total{image!="",container="${opts.appid}",pod=~"${opts.pods}",namespace="${opts.namespace}"}[${rateAccuracy}])) by (${opts.selector})`,
          }
        case MonitorMetric.memoryUsage:
          return {
            instant: false,
            query: `sum(container_memory_working_set_bytes{image!="",container="${opts.appid}",pod=~"${opts.pods}",namespace="${opts.namespace}"}) by (${opts.selector})`,
          }
      }
    }

export enum MonitorMetric {
  cpuUsage = 'cpuUsage',
  memoryUsage = 'memoryUsage',
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
    queryParams: Record<string, number | string>,
    isRange: boolean,
  ) {
    const endpoint = ServerConfig.APP_MONITOR_URL
    if (!endpoint) {
      this.logger.warn('Metrics not available for no endpoint')
      return {}
    }
    const user = await this.clusterService.getUserByAppid(appid)
    const namespace = user.namespace

    const opts = {
      appid,
      selector: 'pod',
      namespace: namespace,
      pods: 'sealaf-' + appid + '.+',
    }
    const data = {}
    const res = metrics.map(async (metric) => {
      const { query, instant } = getQuery({
        rateAccuracy: requestConfig.rateAccuracy,
      })(opts, metric)

      data[metric] =
        instant || !isRange
          ? await this.query(endpoint, query, user)
          : await this.queryRange(endpoint, query, queryParams, user)
    })

    await Promise.all(res)
    return data
  }

  private async query(endpoint: string, query: string, user: User) {
    return await this.queryInternal(endpoint, { query }, user)
  }

  private async queryRange(
    endpoint: string,
    query: string,
    queryParams: Record<string, number | string>,
    user: User
  ) {
    const range = 3600 // 1 hour
    const now = Math.floor(Date.now() / 1000)
    const start = now - range
    const end = now

    queryParams = {
      range,
      step: 60,
      start,
      end,
      ...queryParams,
    }

    return await this.queryInternal(endpoint, {
      query,
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
          .post(endpoint, {
            ...query,
            namespace: user.namespace
          }, {
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
