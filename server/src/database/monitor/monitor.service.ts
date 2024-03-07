import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { ServerConfig } from 'src/constants'
import { User } from 'src/user/entities/user'

const requestConfig = {
  retryAttempts: 5,
  retryDelayBase: 300,
  rateAccuracy: '1m',
}

@Injectable()
export class DedicatedDatabaseMonitorService {
  private readonly logger = new Logger(DedicatedDatabaseMonitorService.name)

  constructor(private readonly httpService: HttpService) { }

  async getResource(appid: string, user: User) {
    const dbName = this.getDBName(appid)

    const cpu = await this.queryRange(
      `sum(rate(container_cpu_usage_seconds_total{image!="",container!="",pod=~"${dbName}-mongo.+",namespace="${user.namespace}"}[1m])) by (pod)`,
      {
        labels: ['pod'],
      },
      user
    )
    const memory = await this.queryRange(
      `sum(container_memory_working_set_bytes{image!="",container!="",pod=~"${dbName}-mongo.+",namespace="${user.namespace}"}) by (pod)`,
      {
        labels: ['pod'],
      },
      user
    )
    const dataSize = await this.query(
      `sum(mongodb_dbstats_dataSize{pod=~"${dbName}-mongo.+"}) by (database)`,
      {
        labels: ['database'],
      },
      user
    )

    return {
      cpu,
      memory,
      dataSize,
    }
  }

  async getConnection(appid: string, user: User) {
    const dbName = this.getDBName(appid)
    const query = `mongodb_connections{pod=~"${dbName}-mongo.+",state="current"}`
    const connections = await this.queryRange(query, {
      labels: ['pod'],
    }, user)
    return {
      connections,
    }
  }
  async getPerformance(appid: string, user: User) {
    const dbName = this.getDBName(appid)
    const queries = {
      documentOperations: `rate(mongodb_mongod_metrics_document_total{pod=~"${dbName}-mongo.+"}[1m])`,
      queryOperations: `rate(mongodb_op_counters_total{pod=~"${dbName}-mongo.+"}[5m]) or irate(mongodb_op_counters_total{pod=~"${dbName}-mongo.+"}[5m])`,
      pageFaults: `rate(mongodb_extra_info_page_faults_total{pod=~"${dbName}-mongo.+"}[5m]) or irate(mongodb_extra_info_page_faults_total{pod=~"${dbName}-mongo.+"}[5m])`,
    }

    const res = await Promise.all(
      Object.keys(queries).map(async (key) => {
        const query = queries[key]
        const data = await this.queryRange(query, {
          labels: ['pod', 'type', 'state'],
        }, user)
        return data
      }),
    )

    const keys = Object.keys(queries)
    return res.reduce((acc, cur, idx) => {
      acc[keys[idx]] = cur
      return acc
    }, {})
  }

  getDBName(appid: string) {
    return `sealaf-${appid}`
  }

  private async query(
    query: string,
    queryParams: Record<string, number | string | string[]>,
    user: User
  ) {
    const endpoint = ServerConfig.DATABASE_MONITOR_URL
    if (!endpoint) return []

    return await this.queryInternal(endpoint, { query, ...queryParams }, user)
  }

  private async queryRange(
    query: string,
    queryParams: Record<string, number | string | string[]>,
    user: User
  ) {
    const endpoint = ServerConfig.DATABASE_MONITOR_URL
    if (!endpoint) return []

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
    query: Record<string, string | number | string[]>,
    user: User
  ) {
    const labels = query.labels
    delete query['labels']
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

        if (!labels || !Array.isArray(labels)) return res.data.data.result

        return res.data.data.result.map((v) => {
          const metric = v.metric
          for (const item in metric) {
            if (!labels.includes(item)) {
              delete metric[item]
            }
          }
          return v
        })
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
