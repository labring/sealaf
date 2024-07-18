import {
  V1Deployment,
  V1DeploymentSpec,
  V1ServiceSpec,
  V2HorizontalPodAutoscaler,
  V2HorizontalPodAutoscalerSpec,
} from '@kubernetes/client-node'
import { Injectable, Logger } from '@nestjs/common'
import { LABEL_KEY_APP_ID, MB, ServerConfig } from '../constants'
import { ClusterService } from 'src/region/cluster/cluster.service'
import { ApplicationWithRelations } from 'src/application/entities/application'
import { ApplicationService } from 'src/application/application.service'
import * as assert from 'assert'
import { CloudBinBucketService } from 'src/storage/cloud-bin-bucket.service'
import { DedicatedDatabaseService } from 'src/database/dedicated-database/dedicated-database.service'

@Injectable()
export class InstanceService {
  private readonly logger = new Logger('InstanceService')

  constructor(
    private readonly cluster: ClusterService,
    private readonly dedicatedDatabaseService: DedicatedDatabaseService,
    private readonly applicationService: ApplicationService,
    private readonly cloudbin: CloudBinBucketService,
  ) {}

  getAppDeployName(appid: string) {
    return `sealaf-${appid}`
  }

  public async create(appid: string) {
    const app = await this.applicationService.findOneUnsafe(appid)
    const labels: Record<string, string> = this.getRuntimeLabel(appid)

    // ensure deployment created
    const res = await this.get(app.appid)
    if (!res.deployment) {
      await this.createDeployment(app, labels)
    }

    // ensure service created
    if (!res.service) {
      await this.createService(app, labels)
    }

    if (!res.hpa) {
      await this.createHorizontalPodAutoscaler(app, labels)
    }
  }

  public async remove(appid: string) {
    const app = await this.applicationService.findOneUnsafe(appid)
    const user = app.user
    const { deployment, service, hpa } = await this.get(appid)
    const name = this.getAppDeployName(appid)

    const namespace = user.namespace

    const appsV1Api = this.cluster.makeAppsV1Api()
    const coreV1Api = this.cluster.makeCoreV1Api()
    const hpaV2Api = this.cluster.makeHorizontalPodAutoscalingV2Api()

    // ensure deployment deleted
    if (deployment) {
      await appsV1Api.deleteNamespacedDeployment(name, namespace)
    }
    // ensure service deleted
    if (service) {
      await coreV1Api.deleteNamespacedService(name, namespace)
    }

    if (hpa) {
      await hpaV2Api.deleteNamespacedHorizontalPodAutoscaler(name, namespace)
    }

    this.logger.log(`remove k8s deployment ${deployment?.metadata?.name}`)
  }

  public async get(appid: string) {
    const app = await this.applicationService.findOneUnsafe(appid)
    const user = app.user
    const namespace = user.namespace
    if (!namespace) {
      return { deployment: null, service: null, hpa: null, app }
    }

    const deployment = await this.getDeployment(app)
    const service = await this.getService(app)
    const hpa = await this.getHorizontalPodAutoscaler(app)
    return { deployment, service, hpa, app }
  }

  public async restart(appid: string) {
    const app = await this.applicationService.findOneUnsafe(appid)
    const user = app.user
    const { deployment, hpa, service } = await this.get(appid)
    if (!deployment || !service) {
      await this.create(appid)
      this.logger.log(
        `restart app ${appid} but app k8s deployment or service not found,and recreate it`,
      )
      return
    }

    // reapply deployment
    deployment.spec = await this.makeDeploymentSpec(
      app,
      deployment.spec.template.metadata.labels,
      this.getRuntimeLabel(appid),
    )
    const appsV1Api = this.cluster.makeAppsV1Api()
    const deploymentResult = await appsV1Api.replaceNamespacedDeployment(
      this.getAppDeployName(appid),
      user.namespace,
      deployment,
    )

    this.logger.log(
      `restart k8s deployment ${deploymentResult.body?.metadata?.name}`,
    )

    // reapply service
    service.spec = this.makeServiceSpec(
      deployment.spec.template.metadata.labels,
    )
    const coreV1Api = this.cluster.makeCoreV1Api()
    const serviceResult = await coreV1Api.replaceNamespacedService(
      service.metadata.name,
      user.namespace,
      service,
    )

    this.logger.log(`restart k8s service ${serviceResult.body?.metadata?.name}`)

    // reapply hpa when application is restarted
    await this.reapplyHorizontalPodAutoscaler(app, hpa)
  }

  private async createDeployment(
    app: ApplicationWithRelations,
    labels: Record<string, string>,
  ) {
    const appid = app.appid
    const user = app.user
    const name = this.getAppDeployName(appid)

    const namespace = user.namespace

    // create deployment
    const data = new V1Deployment()
    data.metadata = { name, labels }
    data.spec = await this.makeDeploymentSpec(app, labels, labels)

    const appsV1Api = this.cluster.makeAppsV1Api()
    const res = await appsV1Api.createNamespacedDeployment(namespace, data)

    this.logger.log(`create k8s deployment ${res.body?.metadata?.name}`)

    return res.body
  }

  private async createService(
    app: ApplicationWithRelations,
    labels: Record<string, string>,
  ) {
    const user = app.user

    const serviceName = this.getAppDeployName(app.appid)
    const coreV1Api = this.cluster.makeCoreV1Api()
    const spec = this.makeServiceSpec(labels)
    const res = await coreV1Api.createNamespacedService(user.namespace, {
      metadata: { name: serviceName, labels },
      spec: spec,
    })
    this.logger.log(`create k8s service ${res.body?.metadata?.name}`)
    return res.body
  }

  private async getDeployment(app: ApplicationWithRelations) {
    const appid = app.appid
    const user = app.user
    const name = this.getAppDeployName(appid)

    const appsV1Api = this.cluster.makeAppsV1Api()
    try {
      const res = await appsV1Api.readNamespacedDeployment(name, user.namespace)
      return res.body
    } catch (error) {
      if (error?.response?.body?.reason === 'NotFound') return null
      throw error
    }
  }

  private async getService(app: ApplicationWithRelations) {
    const appid = app.appid
    const user = app.user
    assert(user, 'user is required')

    const coreV1Api = this.cluster.makeCoreV1Api()
    try {
      const serviceName = this.getAppDeployName(appid)
      const res = await coreV1Api.readNamespacedService(
        serviceName,
        user.namespace,
      )
      return res.body
    } catch (error) {
      if (error?.response?.body?.reason === 'NotFound') return null
      throw error
    }
  }

  private makeServiceSpec(labels: Record<string, string>) {
    const spec: V1ServiceSpec = {
      selector: labels,
      type: 'ClusterIP',
      ports: [{ port: 8000, targetPort: 8000, protocol: 'TCP', name: 'http' }],
    }
    return spec
  }

  private async makeDeploymentSpec(
    app: ApplicationWithRelations,
    labels: Record<string, string>,
    matchLabels: Record<string, string>,
  ): Promise<V1DeploymentSpec> {
    const { appid, region, user } = app
    assert(region, 'region is required')

    // prepare params
    const limitMemory = app.bundle.resource.limitMemory
    const limitCpu = app.bundle.resource.limitCPU
    const requestMemory = app.bundle.resource.requestMemory
    const requestCpu = app.bundle.resource.requestCPU
    const max_old_space_size = ~~(limitMemory * 0.8)
    const max_http_header_size = 1 * MB
    const dependencies = app.configuration?.dependencies || []
    const dependencies_string = dependencies.join(' ')
    const npm_install_flags = region.clusterConf.npmInstallFlags || ''

    // db connection uri
    let dbConnectionUri: string
    const dedicatedDatabase = await this.dedicatedDatabaseService.findOne(appid)
    if (dedicatedDatabase) {
      dbConnectionUri = await this.dedicatedDatabaseService.getConnectionUri(
        user,
        dedicatedDatabase,
      )
    }

    const NODE_MODULES_PUSH_URL =
      await this.cloudbin.getNodeModulesCachePushUrl(appid)

    const NODE_MODULES_PULL_URL =
      await this.cloudbin.getNodeModulesCachePullUrl(appid)

    const storageConf = await this.cluster.getStorageConf(user)

    const env = [
      { name: 'DB_URI', value: dbConnectionUri },
      { name: 'APP_ID', value: appid }, // deprecated, use `APPID` instead
      { name: 'APPID', value: appid },
      { name: 'OSS_ACCESS_KEY', value: storageConf.accessKey },
      { name: 'OSS_ACCESS_SECRET', value: storageConf.secretKey },
      {
        name: 'OSS_INTERNAL_ENDPOINT',
        value: storageConf.internal,
      },
      {
        name: 'OSS_EXTERNAL_ENDPOINT',
        value: storageConf.external,
      },
      { name: 'OSS_REGION', value: region.name },
      {
        name: 'FLAGS',
        value: `--max_old_space_size=${max_old_space_size} --max-http-header-size=${max_http_header_size}`,
      },
      { name: 'DEPENDENCIES', value: dependencies_string },
      { name: 'NODE_MODULES_PUSH_URL', value: NODE_MODULES_PUSH_URL },
      { name: 'NODE_MODULES_PULL_URL', value: NODE_MODULES_PULL_URL },
      { name: 'NPM_INSTALL_FLAGS', value: npm_install_flags },
      {
        name: 'CUSTOM_DEPENDENCY_BASE_PATH',
        value: ServerConfig.RUNTIME_CUSTOM_DEPENDENCY_BASE_PATH,
      },
      {
        name: 'RESTART_AT',
        value: new Date().getTime().toString(),
      },
      {
        name: 'IS_SEALAF',
        value: 'true',
      },
    ]

    // merge env from app configuration, override if exists
    const extraEnv = app.configuration.environments || []
    extraEnv.forEach((e) => {
      const index = env.findIndex((x) => x.name === e.name)
      if (index > -1) {
        env[index] = e
      } else {
        env.push(e)
      }
    })

    const spec: V1DeploymentSpec = {
      replicas: 1,
      selector: { matchLabels },
      template: {
        metadata: { labels },
        spec: {
          terminationGracePeriodSeconds: 10,
          automountServiceAccountToken: false,
          enableServiceLinks: false,
          containers: [
            {
              image: app.runtime.image.main,
              imagePullPolicy: 'IfNotPresent',
              command: ['sh', '/app/start.sh'],
              name: appid,
              env,
              ports: [{ containerPort: 8000, name: 'http' }],
              resources: {
                limits: {
                  cpu: `${limitCpu}m`,
                  memory: `${limitMemory}Mi`,
                  'ephemeral-storage': '4Gi',
                },
                requests: {
                  cpu: `${requestCpu}m`,
                  memory: `${requestMemory}Mi`,
                  'ephemeral-storage': '64Mi',
                },
              },
              volumeMounts: [
                {
                  name: 'app',
                  mountPath: `${ServerConfig.RUNTIME_CUSTOM_DEPENDENCY_BASE_PATH}/node_modules/`,
                },
              ],
              startupProbe: {
                httpGet: {
                  path: '/_/healthz',
                  port: 'http',
                  httpHeaders: [{ name: 'Referer', value: 'startupProbe' }],
                },
                initialDelaySeconds: 0,
                periodSeconds: 1,
                timeoutSeconds: 1,
                failureThreshold: 300,
              },
              readinessProbe: {
                httpGet: {
                  path: '/_/healthz',
                  port: 'http',
                  httpHeaders: [{ name: 'Referer', value: 'readinessProbe' }],
                },
                initialDelaySeconds: 0,
                periodSeconds: 60,
                timeoutSeconds: 3,
                failureThreshold: 1,
              },
              securityContext: {
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: false,
                privileged: false,
                capabilities: {
                  drop: ['ALL'],
                },
              },
            },
          ],
          initContainers: [
            {
              name: 'init',
              image: app.runtime.image.init,
              imagePullPolicy: 'IfNotPresent',
              command: ['sh', '/app/init.sh'],
              env,
              volumeMounts: [
                {
                  name: 'app',
                  mountPath: '/app/node_modules/',
                },
              ],
              resources: {
                limits: {
                  cpu: `1000m`,
                  memory: `1024Mi`,
                  'ephemeral-storage': '4Gi',
                },
                requests: {
                  cpu: '5m',
                  memory: '32Mi',
                  'ephemeral-storage': '64Mi',
                },
              },
              securityContext: {
                allowPrivilegeEscalation: false,
                // readOnlyRootFilesystem: true,
                privileged: false,
              },
            },
          ],
          volumes: [
            {
              name: 'app',
              emptyDir: {
                sizeLimit: '4Gi',
              },
            },
          ],
          securityContext: {
            runAsUser: 1000, // node
            runAsGroup: 2000,
            runAsNonRoot: true,
            fsGroup: 2000,
            seccompProfile: {
              type: 'RuntimeDefault',
            },
          },
        }, // end of spec {}
      }, // end of template {}
    }

    if (region.clusterConf.runtimeAffinity) {
      spec.template.spec.affinity = region.clusterConf.runtimeAffinity
    }

    return spec
  }

  private async createHorizontalPodAutoscaler(
    app: ApplicationWithRelations,
    labels: Record<string, string>,
  ) {
    if (!app.bundle.autoscaling.enable) return null

    const user = app.user

    const spec = this.makeHorizontalPodAutoscalerSpec(app)
    const hpaV2Api = this.cluster.makeHorizontalPodAutoscalingV2Api()
    const res = await hpaV2Api.createNamespacedHorizontalPodAutoscaler(
      user.namespace,
      {
        apiVersion: 'autoscaling/v2',
        kind: 'HorizontalPodAutoscaler',
        spec,
        metadata: {
          name: this.getAppDeployName(app.appid),
          labels,
        },
      },
    )
    this.logger.log(`create k8s hpa ${res.body?.metadata?.name}`)
    return res.body
  }

  private async getHorizontalPodAutoscaler(app: ApplicationWithRelations) {
    const appid = app.appid
    const user = app.user

    const hpaV2Api = this.cluster.makeHorizontalPodAutoscalingV2Api()

    try {
      const hpaName = this.getAppDeployName(appid)
      const res = await hpaV2Api.readNamespacedHorizontalPodAutoscaler(
        hpaName,
        user.namespace,
      )
      return res.body
    } catch (error) {
      if (error?.response?.body?.reason === 'NotFound') return null
      throw error
    }
  }

  private makeHorizontalPodAutoscalerSpec(app: ApplicationWithRelations) {
    const {
      minReplicas,
      maxReplicas,
      targetCPUUtilizationPercentage,
      targetMemoryUtilizationPercentage,
    } = app.bundle.autoscaling

    const metrics: V2HorizontalPodAutoscalerSpec['metrics'] = []

    if (targetCPUUtilizationPercentage) {
      metrics.push({
        type: 'Resource',
        resource: {
          name: 'cpu',
          target: {
            type: 'Utilization',
            averageUtilization: targetCPUUtilizationPercentage * 10,
          },
        },
      })
    }

    if (targetMemoryUtilizationPercentage) {
      metrics.push({
        type: 'Resource',
        resource: {
          name: 'memory',
          target: {
            type: 'Utilization',
            averageUtilization: targetMemoryUtilizationPercentage * 2,
          },
        },
      })
    }

    const spec: V2HorizontalPodAutoscalerSpec = {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: this.getAppDeployName(app.appid),
      },
      minReplicas,
      maxReplicas,
      metrics,
      behavior: {
        scaleDown: {
          policies: [
            {
              type: 'Pods',
              value: 1,
              periodSeconds: 60,
            },
          ],
        },
        scaleUp: {
          policies: [
            {
              type: 'Pods',
              value: 1,
              periodSeconds: 60,
            },
          ],
        },
      },
    }
    return spec
  }

  public async reapplyHorizontalPodAutoscaler(
    app: ApplicationWithRelations,
    oldHpa: V2HorizontalPodAutoscaler,
  ) {
    const appid = app.appid
    const user = app.user

    const hpaV2Api = this.cluster.makeHorizontalPodAutoscalingV2Api()

    const hpa = oldHpa

    if (!app.bundle.autoscaling.enable) {
      if (!hpa) return
      await hpaV2Api.deleteNamespacedHorizontalPodAutoscaler(
        this.getAppDeployName(appid),
        user.namespace,
      )
      this.logger.log(`delete k8s hpa ${app.appid}`)
    } else {
      if (hpa) {
        hpa.spec = this.makeHorizontalPodAutoscalerSpec(app)
        await hpaV2Api.replaceNamespacedHorizontalPodAutoscaler(
          this.getAppDeployName(app.appid),
          user.namespace,
          hpa,
        )
      } else {
        const labels = this.getRuntimeLabel(appid)
        await this.createHorizontalPodAutoscaler(app, labels)
      }
      this.logger.log(`reapply k8s hpa ${app.appid}`)
    }
  }

  private getRuntimeLabel(appid: string) {
    const SEALOS = 'cloud.sealos.io/app-deploy-manager'
    const labels: Record<string, string> = {
      [LABEL_KEY_APP_ID]: appid,
      [SEALOS]: this.getAppDeployName(appid),
      app: this.getAppDeployName(appid),
    }

    return labels
  }
}
