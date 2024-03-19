import { Injectable, Logger } from '@nestjs/common'
import { KubernetesObject, V1Ingress } from '@kubernetes/client-node'
import * as k8s from '@kubernetes/client-node'
import { compare } from 'fast-json-patch'
import { GroupVersionKind } from 'src/region/cluster/types'
import { User } from 'src/user/entities/user'
import { SystemDatabase } from 'src/system-database'
import { Application } from 'src/application/entities/application'
import * as assert from 'node:assert'
import { delay } from 'lodash'

@Injectable()
export class ClusterService {
  private readonly logger = new Logger(ClusterService.name)

  async getUserByAppid(appid: string) {
    const db = SystemDatabase.db
    const app = await db
      .collection<Application>('Application')
      .findOne({ appid })
    if (!app) return null
    const user = await db
      .collection<User>('User')
      .findOne({ _id: app.createdBy })
    return user
  }

  loadKubeConfig(user: User) {
    const conf = user.kubeconfig
    const kc = new k8s.KubeConfig()
    kc.loadFromString(conf)
    kc.clusters[0].server = 'https://kubernetes.default.svc.cluster.local'
    return kc
  }

  async applyYamlString(user: User, specString: string) {
    const api = this.makeObjectApi(user)
    const specs: KubernetesObject[] = k8s.loadAllYaml(specString)
    const validSpecs = specs.filter((s) => s && s.kind && s.metadata)
    const created: k8s.KubernetesObject[] = []

    for (const spec of validSpecs) {
      spec.metadata = spec.metadata || {}
      spec.metadata.annotations = spec.metadata.annotations || {}
      delete spec.metadata.annotations[
        'kubectl.kubernetes.io/last-applied-configuration'
      ]
      spec.metadata.annotations[
        'kubectl.kubernetes.io/last-applied-configuration'
      ] = JSON.stringify(spec)
      spec.metadata.namespace = user.namespace

      try {
        // try to get the resource, if it does not exist an error will be thrown and we will end up in the catch
        // block.
        await api.read(spec as any)
        // we got the resource, so it exists, so patch it
        //
        // Note that this could fail if the spec refers to a custom resource. For custom resources you may need
        // to specify a different patch merge strategy in the content-type header.
        //
        // See: https://github.com/kubernetes/kubernetes/issues/97423
        const response = await api.patch(
          spec,
          undefined,
          undefined,
          undefined,
          undefined,
          {
            headers: {
              'Content-Type': k8s.PatchUtils.PATCH_FORMAT_JSON_MERGE_PATCH,
            },
          },
        )
        created.push(response.body)
      } catch (e) {
        // not exist, create
        const response = await api.create(spec)
        created.push(response.body)
      }
    }
    return created
  }

  async deleteYamlString(user: User, specString: string) {
    const api = this.makeObjectApi(user)
    const specs: k8s.KubernetesObject[] = k8s.loadAllYaml(specString)
    const validSpecs = specs.filter((s) => s && s.kind && s.metadata)
    const deleted: k8s.KubernetesObject[] = []

    for (const spec of validSpecs) {
      spec.metadata.namespace = user.namespace
      try {
        // try to get the resource, if it does not exist an error will be thrown and we will end up in the catch
        // block.
        await api.read(spec as any)
        // we got the resource, so it exists, so delete it
        const response = await api.delete(spec)
        deleted.push(response.body)
      } catch (e) {
        // not exist
      }
    }
    return deleted
  }

  async patchCustomObject(user: User, spec: KubernetesObject) {
    const client = this.makeCustomObjectApi(user)
    const gvk = GroupVersionKind.fromKubernetesObject(spec)

    // get the current spec
    const res = await client.getNamespacedCustomObject(
      gvk.group,
      gvk.version,
      spec.metadata.namespace,
      gvk.plural,
      spec.metadata.name,
    )
    const currentSpec = res.body as KubernetesObject

    // calculate the patch
    const patch = compare(currentSpec, spec)
    const options = {
      headers: {
        'Content-Type': k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH,
      },
    }

    // apply the patch
    const response = await client.patchNamespacedCustomObject(
      gvk.group,
      gvk.version,
      spec.metadata.namespace,
      gvk.plural,
      spec.metadata.name,
      patch,
      undefined,
      undefined,
      undefined,
      options,
    )

    return response.body
  }

  async deleteCustomObject(user: User, spec: KubernetesObject) {
    const client = this.makeCustomObjectApi(user)
    const gvk = GroupVersionKind.fromKubernetesObject(spec)

    const response = await client.deleteNamespacedCustomObject(
      gvk.group,
      gvk.version,
      spec.metadata.namespace,
      gvk.plural,
      spec.metadata.name,
    )

    return response.body
  }

  async getIngress(user: User, name: string) {
    const api = this.makeNetworkingApi(user)
    const namespace = user.namespace

    try {
      const res = await api.readNamespacedIngress(name, namespace)
      return res.body
    } catch (err) {
      // if ingress not found, return null
      if (err?.response?.statusCode === 404) {
        return null
      }

      this.logger.error(err)
      this.logger.error(err?.response?.body)
      throw err
    }
  }

  async createIngress(user: User, body: V1Ingress) {
    body.apiVersion = 'networking.k8s.io/v1'
    body.kind = 'Ingress'
    const api = this.makeNetworkingApi(user)
    const res = await api.createNamespacedIngress(body.metadata.namespace, body)
    return res.body
  }

  async deleteIngress(user: User, name: string) {
    const api = this.makeNetworkingApi(user)
    const namespace = user.namespace
    const res = await api.deleteNamespacedIngress(name, namespace)
    return res.body
  }

  async createStorageUser(user: User) {
    const api = this.makeCustomObjectApi(user)
    const name = user.namespace.replace('ns-', '')
    const res = await api.createNamespacedCustomObject(
      'objectstorage.sealos.io',
      'v1',
      user.namespace,
      'objectstorageusers',
      {
        apiVersion: 'objectstorage.sealos.io/v1',
        kind: 'ObjectStorageUser',
        metadata: {
          name,
          namespace: user.namespace,
        },
      },
    )
    return res
  }

  async getStorageConf(user: User) {
    const api = this.makeCustomObjectApi(user)
    const name = user.namespace.replace('ns-', '')

    let status
    try {
      const res = await api.getNamespacedCustomObject(
        'objectstorage.sealos.io',
        'v1',
        user.namespace,
        'objectstorageusers',
        name,
      )
      status = (res.body as any)?.status
    } catch {
      await this.createStorageUser(user)
      const watch = new k8s.Watch(this.loadKubeConfig(user))
      const wait = (timeout: number) =>
        new Promise((resolve, reject) => {
          watch
            .watch(
              `/apis/objectstorage.sealos.io/v1/namespaces/${user.namespace}/objectstorageusers/${name}`,
              {},
              (type, apiObj, watchObj) => {
                if (watchObj.status) {
                  resolve(watchObj.status)
                }
              },
              (err) => err && reject(err),
            )
            .then((req) => {
              delay(() => {
                req.abort()
                reject(
                  `wait for storage user ${name} in ${user.namespace} ready timeout`,
                )
              }, timeout)
            })
        })

      status = await wait(30000)
    }

    assert(status, 'storage conf cannot be empty')

    return {
      accessKey: status.accessKey,
      secretKey: status.secretKey,
      external: 'https://' + status.external,
      internal: 'http://' + status.internal,
    }
  }

  async getStorageBucket(user: User, name: string) {
    const api = this.makeCustomObjectApi(user)
    const res = await api.getNamespacedCustomObject(
      'objectstorage.sealos.io',
      'v1',
      user.namespace,
      'objectstoragebuckets',
      name,
    )

    const status = (res.body as any)?.status
    if (!status) {
      return null
    }

    return {
      name: status.name,
    }
  }

  async createStorageBucket(
    user: User,
    name: string,
    policy: 'public' | 'readonly' | 'private',
  ) {
    const api = this.makeCustomObjectApi(user)
    await api.createNamespacedCustomObject(
      'objectstorage.sealos.io',
      'v1',
      user.namespace,
      'objectstoragebuckets',
      {
        apiVersion: 'objectstorage.sealos.io/v1',
        kind: 'ObjectStorageBucket',
        metadata: {
          name,
          namespace: user.namespace,
        },
        spec: {
          policy,
        },
      },
    )

    const watch = new k8s.Watch(this.loadKubeConfig(user))
    const wait = (timeout: number) =>
      new Promise((resolve, reject) => {
        watch
          .watch(
            `/apis/objectstorage.sealos.io/v1/namespaces/${user.namespace}/objectstoragebuckets/${name}`,
            {},
            (type, apiObj, watchObj) => {
              if (watchObj.status) {
                resolve(watchObj.status.name)
              }
            },
            (err) => err && reject(err),
          )
          .then((req) => {
            delay(() => {
              req.abort()
              reject(
                `wait for bucket ${name} in ${user.namespace} ready timeout`,
              )
            }, timeout)
          })
      })

    const bucketName = await wait(30000)
    return {
      name: bucketName as string,
    }
  }

  async deleteStorageBucket(user: User, name: string) {
    const api = this.makeCustomObjectApi(user)
    const res = await api.deleteNamespacedCustomObject(
      'objectstorage.sealos.io',
      'v1',
      user.namespace,
      'objectstoragebuckets',
      name,
    )
    return res.body
  }

  makeCoreV1Api(user: User) {
    const kc = this.loadKubeConfig(user)
    return kc.makeApiClient(k8s.CoreV1Api)
  }

  makeAppsV1Api(user: User) {
    const kc = this.loadKubeConfig(user)
    return kc.makeApiClient(k8s.AppsV1Api)
  }

  makeBatchV1Api(user: User) {
    const kc = this.loadKubeConfig(user)
    return kc.makeApiClient(k8s.BatchV1Api)
  }

  makeObjectApi(user: User) {
    const kc = this.loadKubeConfig(user)
    return kc.makeApiClient(k8s.KubernetesObjectApi)
  }

  makeCustomObjectApi(user: User) {
    const kc = this.loadKubeConfig(user)
    return kc.makeApiClient(k8s.CustomObjectsApi)
  }

  makeHorizontalPodAutoscalingV2Api(user: User) {
    const kc = this.loadKubeConfig(user)
    return kc.makeApiClient(k8s.AutoscalingV2Api)
  }

  makeNetworkingApi(user: User) {
    const kc = this.loadKubeConfig(user)
    return kc.makeApiClient(k8s.NetworkingV1Api)
  }
}
