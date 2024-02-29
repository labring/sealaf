import {
  Controller,
  Logger,
  Param,
  Query,
  UseGuards,
  Sse,
} from '@nestjs/common'
import http from 'http'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { FunctionService } from '../function/function.service'
import { JwtAuthGuard } from 'src/authentication/jwt.auth.guard'
import { ApplicationAuthGuard } from 'src/authentication/application.auth.guard'
import { PassThrough } from 'nodemailer/lib/xoauth2'
import { Log } from '@kubernetes/client-node'
import { RegionService } from 'src/region/region.service'
import { ClusterService } from 'src/region/cluster/cluster.service'
import { Observable } from 'rxjs'
import { PodService } from 'src/application/pod.service'
import { InjectUser } from 'src/utils/decorator'
import { User } from 'src/user/entities/user'

@ApiBearerAuth('Authorization')
@Controller('apps/:appid/logs')
export class LogController {
  private readonly logger = new Logger(LogController.name)

  constructor(
    private readonly funcService: FunctionService,
    private readonly regionService: RegionService,
    private readonly clusterService: ClusterService,
    private readonly podService: PodService,
  ) {}

  @ApiTags('Application')
  @ApiOperation({ summary: 'Get app pod logs' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Sse(':podName')
  async streamLogs(
    @Param('podName') podName: string,
    @Query('containerName') containerName: string,
    @Param('appid') appid: string,
    @InjectUser('user') user: User
  ) {
    if (!containerName) {
      containerName = appid
    }

    let podNameList: string[] = (
      await this.podService.getPodNameListByAppid(appid)
    ).podNameList

    if (!podNameList.includes(podName) && podName !== 'all') {
      return new Observable<MessageEvent>((subscriber) => {
        subscriber.next(
          JSON.stringify({
            error: 'podName not exist',
          }) as unknown as MessageEvent,
        )
        subscriber.complete()
      })
    }

    if (podName !== 'all') {
      podNameList = undefined
    }

    const region = await this.regionService.findByAppId(appid)
    const kc = this.clusterService.loadKubeConfig(user)

    return new Observable<MessageEvent>((subscriber) => {
      const combinedLogStream = new PassThrough()
      const logs = new Log(kc)

      const streamsEnded = new Set<string>()

      const destroyStream = () => {
        combinedLogStream?.removeAllListeners()
        combinedLogStream?.destroy()
      }

      combinedLogStream.on('data', (chunk) => {
        subscriber.next(chunk.toString() as MessageEvent)
      })

      combinedLogStream.on('error', (error) => {
        this.logger.error('Combined stream error', error)
        subscriber.error(error)
        destroyStream()
      })

      combinedLogStream.on('end', () => {
        subscriber.complete()
        destroyStream()
      })

      const fetchLog = async (podName: string) => {
        let k8sResponse: http.IncomingMessage | undefined
        const podLogStream = new PassThrough()
        streamsEnded.add(podName)

        try {
          k8sResponse = await logs.log(
            user.namespace,
            podName,
            containerName,
            podLogStream,
            {
              follow: true,
              previous: false,
              pretty: false,
              timestamps: false,
              tailLines: 1000,
            },
          )
          podLogStream.pipe(combinedLogStream, { end: false })

          podLogStream.on('error', (error) => {
            combinedLogStream.emit('error', error)
            podLogStream.removeAllListeners()
            podLogStream.destroy()
          })

          podLogStream.once('end', () => {
            streamsEnded.delete(podName)
            if (streamsEnded.size === 0) {
              combinedLogStream.end()
            }
          })
        } catch (error) {
          this.logger.error(`Failed to get logs for pod ${podName}`, error)
          subscriber.error(error)
          k8sResponse?.destroy()
          podLogStream.removeAllListeners()
          podLogStream.destroy()
          destroyStream()
        }
      }

      if (podNameList && podNameList.length > 0) {
        podNameList.forEach((podName) => {
          fetchLog(podName)
        })
      } else {
        fetchLog(podName)
      }
      // Clean up when the client disconnects
      return () => destroyStream()
    })
  }
}
