import {
  Controller,
  Logger,
  Param,
  Query,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common'
import http from 'http'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/authentication/jwt.auth.guard'
import { ApplicationAuthGuard } from 'src/authentication/application.auth.guard'
import { PassThrough } from 'nodemailer/lib/xoauth2'
import { Log } from '@kubernetes/client-node'
import { ClusterService } from 'src/region/cluster/cluster.service'
import { Observable } from 'rxjs'
import { PodService } from 'src/application/pod.service'
import { InjectUser } from 'src/utils/decorator'
import { UserWithKubeconfig } from 'src/user/entities/user'

@ApiBearerAuth('Authorization')
@Controller('apps/:appid/logs')
export class LogController {
  private readonly logger = new Logger(LogController.name)

  constructor(
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
    @InjectUser('user') user: UserWithKubeconfig,
  ) {
    if (!containerName) {
      containerName = appid
    }

    const podStatus = await this.podService.getPodStatusListByAppid(user, appid)

    if (!podStatus.podStatus[0]) {
      return new Observable<MessageEvent>((subscriber) => {
        subscriber.error(new Error('pod not exist'))
      })
    }

    const podNameList = podStatus.podStatus.map((pod) => pod.name)

    const initContainerId = podStatus.podStatus.map(
      (pod) => pod.initContainerId,
    )

    if (containerName === 'init') {
      for (const containerId of initContainerId) {
        if (!containerId) {
          return new Observable<MessageEvent>((subscriber) => {
            subscriber.error(new Error('init container not exist'))
          })
        }
      }
    }

    if (podName !== 'all') {
      if (!podNameList.includes(podName)) {
        return new Observable<MessageEvent>((subscriber) => {
          subscriber.error(new Error('podName not exist'))
        })
      }
    }

    const kc = this.clusterService.loadKubeConfig(user)

    return new Observable<MessageEvent>((subscriber) => {
      const combinedLogStream = new PassThrough()
      const logs = new Log(kc)

      const streamsEnded = new Set<string>()
      const k8sLogResponses: http.IncomingMessage[] = []
      const podLogStreams: PassThrough[] = []

      const destroyStream = () => {
        combinedLogStream.removeAllListeners()
        combinedLogStream.destroy()

        k8sLogResponses.forEach((response) => {
          response.removeAllListeners()
          response.destroy()
        })

        podLogStreams.forEach((stream) => {
          stream.removeAllListeners()
          stream.destroy()
        })
      }

      let idCounter = 1
      combinedLogStream.on('data', (chunk) => {
        const dataString = chunk.toString()
        const messageEvent: MessageEvent = {
          id: idCounter.toString(),
          data: dataString,
          type: 'log',
        }
        idCounter++
        subscriber.next(messageEvent)
      })

      combinedLogStream.on('error', (error) => {
        this.logger.error('Combined stream error', error)
        subscriber.error(error)
        destroyStream()
      })

      combinedLogStream.on('close', () => {
        subscriber.complete()
        destroyStream()
      })

      const fetchLog = async (podName: string) => {
        const podLogStream = new PassThrough()
        streamsEnded.add(podName)
        podLogStreams.push(podLogStream)

        try {
          const k8sResponse: http.IncomingMessage = await logs.log(
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

          k8sLogResponses.push(k8sResponse)

          podLogStream.pipe(combinedLogStream, { end: false })

          podLogStream.on('error', (error) => {
            subscriber.error(error)
            this.logger.error(`podLogStream error for pod ${podName}`, error)
            destroyStream()
          })

          k8sResponse.on('close', () => {
            streamsEnded.delete(podName)
            if (streamsEnded.size === 0) {
              combinedLogStream.emit('close')
            }
          })

          podLogStream.on('close', () => {
            streamsEnded.delete(podName)
            if (streamsEnded.size === 0) {
              combinedLogStream.emit('close')
            }
          })
        } catch (error) {
          subscriber.error(error)
          this.logger.error(`Failed to get logs for pod ${podName}`, error)
          destroyStream()
        }
      }

      if (podName === 'all' && podNameList.length > 0) {
        podNameList.forEach((podName) => {
          fetchLog(podName)
        })
      } else {
        fetchLog(podName)
      }

      // Clean up when the client disconnects
      return () => {
        destroyStream()
      }
    })
  }
}
