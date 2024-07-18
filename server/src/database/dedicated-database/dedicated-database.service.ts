import { Injectable, Logger } from '@nestjs/common'
import { Region } from 'src/region/entities/region'
import {
  DedicatedDatabase,
  DedicatedDatabasePhase,
  DedicatedDatabaseSpec,
  DedicatedDatabaseState,
} from '../entities/dedicated-database'
import { ClusterService } from 'src/region/cluster/cluster.service'
import * as _ from 'lodash'
import { SystemDatabase } from 'src/system-database'
import { KubernetesObject, loadAllYaml } from '@kubernetes/client-node'
import {
  CN_PUBLISHED_CONF,
  CN_PUBLISHED_FUNCTIONS,
  TASK_LOCK_INIT_TIME,
} from 'src/constants'
import { ClientSession, ObjectId } from 'mongodb'
import * as mongodb_uri from 'mongodb-uri'
import { MongoService } from 'src/database/mongo.service'
import { MongoAccessor } from 'database-proxy'
import { ApplicationBundle } from 'src/application/entities/application-bundle'
import * as assert from 'assert'
import { User, UserWithKubeconfig } from 'src/user/entities/user'
import { promisify } from 'util'
import { exec } from 'child_process'
import { CloudFunction } from 'src/function/entities/cloud-function'
import { ApplicationConfiguration } from 'src/application/entities/application-configuration'
import {
  DatabaseSyncRecord,
  DatabaseSyncState,
} from '../entities/database-sync-record'

const getDedicatedDatabaseName = (appid: string) => `sealaf-${appid}`
const p_exec = promisify(exec)

@Injectable()
export class DedicatedDatabaseService {
  private readonly logger = new Logger(DedicatedDatabase.name)

  constructor(
    private readonly cluster: ClusterService,
    private readonly mongoService: MongoService,
  ) {}

  async create(appid: string, session?: ClientSession) {
    const db = SystemDatabase.db

    await db.collection<DedicatedDatabase>('DedicatedDatabase').insertOne(
      {
        appid,
        name: getDedicatedDatabaseName(appid),
        createdAt: new Date(),
        updatedAt: new Date(),
        lockedAt: TASK_LOCK_INIT_TIME,
        phase: DedicatedDatabasePhase.Starting,
        state: DedicatedDatabaseState.Running,
      },
      { session },
    )
  }

  async applyDeployManifest(
    region: Region,
    user: User,
    appid: string,
    patch?: Partial<DedicatedDatabaseSpec>,
  ) {
    const spec = await this.getDedicatedDatabaseSpec(appid)
    const manifest = this.makeDeployManifest(region, appid, {
      ...spec,
      ...patch,
    })
    const res = await this.cluster.applyYamlString(manifest, user.namespace)
    return res
  }

  async getDedicatedDatabaseSpec(
    appid: string,
  ): Promise<DedicatedDatabaseSpec> {
    const db = SystemDatabase.db

    const bundle = await db
      .collection<ApplicationBundle>('ApplicationBundle')
      .findOne({ appid })

    return bundle.resource.dedicatedDatabase
  }

  async findOne(appid: string) {
    const db = SystemDatabase.db

    const res = await db
      .collection<DedicatedDatabase>('DedicatedDatabase')
      .findOne({
        appid,
      })

    return res
  }

  async deleteDeployManifest(region: Region, user: User, appid: string) {
    const manifest = await this.getDeployManifest(region, user, appid)
    const res = await this.cluster.deleteCustomObject(manifest)
    return res
  }

  async getDeployManifest(region: Region, user: User, appid: string) {
    const api = this.cluster.makeObjectApi()
    const emptyManifest = this.makeDeployManifest(region, appid)
    const specs = loadAllYaml(emptyManifest)
    assert(
      specs && specs.length > 0,
      'the deploy manifest of database should not be empty',
    )
    const spec = specs[0]
    spec.metadata.namespace = user.namespace

    try {
      const manifest = await api.read(spec)
      return manifest.body as KubernetesObject & { spec: any; status: any }
    } catch (err) {
      return null
    }
  }

  makeDeployManifest(
    region: Region,
    appid: string,
    dto?: DedicatedDatabaseSpec,
  ) {
    dto = dto || {
      limitCPU: 0,
      limitMemory: 0,
      requestCPU: 0,
      requestMemory: 0,
      replicas: 0,
      capacity: 0,
    }
    const { limitCPU, limitMemory, replicas, capacity } = dto
    const name = getDedicatedDatabaseName(appid)

    const requestCPU =
      limitCPU * (region.bundleConf?.cpuRequestLimitRatio || 0.1)
    const requestMemory =
      limitMemory * (region.bundleConf?.memoryRequestLimitRatio || 0.5)

    const template = region.deployManifest.database
    const tmpl = _.template(template)
    const manifest = tmpl({
      name,
      limitCPU,
      limitMemory,
      requestCPU,
      requestMemory,
      capacity: capacity / 1024,
      replicas,
    })

    return manifest
  }

  async applyKubeBlockOpsRequestManifest(user: User, appid: string) {
    const manifest = this.makeKubeBlockOpsRequestManifest(appid, user)
    const res = await this.cluster.applyYamlString(manifest, user.namespace)
    return res
  }

  async deleteKubeBlockOpsManifest(user: User, appid: string) {
    const manifest = await this.getKubeBlockOpsRequestManifest(user, appid)
    const res = await this.cluster.deleteCustomObject(manifest)
    return res
  }

  async getKubeBlockOpsRequestManifest(user: User, appid: string) {
    const api = this.cluster.makeObjectApi()
    const emptyManifest = this.makeKubeBlockOpsRequestManifest(appid, user)
    const specs = loadAllYaml(emptyManifest)
    assert(
      specs && specs.length > 0,
      'the OpsRequest manifest of database should not be empty',
    )
    const spec = specs[0]
    try {
      const manifest = await api.read(spec)
      return manifest.body as KubernetesObject & { spec: any; status: any }
    } catch (err) {
      return null
    }
  }

  makeKubeBlockOpsRequestManifest(appid: string, user: User) {
    const template = `
apiVersion: apps.kubeblocks.io/v1alpha1
kind: OpsRequest
metadata:
  name: <%- name %>
  namespace: <%- namespace %>
spec:
  clusterRef: <%- clusterName %>
  type: Restart 
  restart:
  - componentName: mongodb
`
    const clusterName = getDedicatedDatabaseName(appid)
    const namespace = user.namespace
    const tmpl = _.template(template)

    const manifest = tmpl({
      name: clusterName,
      namespace,
      clusterName,
    })

    return manifest
  }

  async updateState(appid: string, state: DedicatedDatabaseState) {
    const db = SystemDatabase.db
    const res = await db
      .collection<DedicatedDatabase>('DedicatedDatabase')
      .findOneAndUpdate(
        { appid },
        { $set: { state, updatedAt: new Date() } },
        { returnDocument: 'after' },
      )

    return res.value
  }

  async getConnectionUri(user: User, database: DedicatedDatabase) {
    const api = this.cluster.makeCoreV1Api()
    const namespace = user.namespace
    const name = getDedicatedDatabaseName(database.appid)
    const secretName = `${name}-conn-credential`
    const srv = await api.readNamespacedSecret(secretName, namespace)
    if (!srv) return null

    const username = Buffer.from(srv.body.data.username, 'base64').toString()
    const password = Buffer.from(srv.body.data.password, 'base64').toString()
    let host = Buffer.from(srv.body.data.headlessHost, 'base64').toString()
    if (host && !host.includes(user.namespace)) {
      host += `.${user.namespace}`
    }
    const port = Number(
      Buffer.from(srv.body.data.headlessPort, 'base64').toString(),
    )

    const uri = mongodb_uri.format({
      username,
      password,
      hosts: [
        {
          host,
          port,
        },
      ],
      database: database.name,
      options: {
        authSource: 'admin',
        replicaSet: `${name}-mongodb`,
        // readPreference: 'secondaryPreferred',
        w: 'majority',
      },
      scheme: 'mongodb',
    })

    return uri
  }

  async findAndConnect(appid: string) {
    const database = await this.findOne(appid)
    if (!database) return null

    const user = await this.cluster.getUserByAppid(appid)
    const connectionUri = await this.getConnectionUri(user, database)

    const client = await this.mongoService.connectDatabase(
      connectionUri,
      database.name,
    )
    const db = client.db(database.name)
    return { db, client }
  }

  /**
   * Get database accessor that used for `database-proxy`
   */
  async getDatabaseAccessor(appid: string) {
    const database = await this.findOne(appid)
    if (!database) return null

    const { client } = await this.findAndConnect(appid)

    const accessor = new MongoAccessor(client)
    return accessor
  }

  async remove(appid: string) {
    const db = SystemDatabase.db
    const doc = await db
      .collection<DedicatedDatabase>('DedicatedDatabase')
      .findOneAndUpdate(
        { appid },
        {
          $set: {
            state: DedicatedDatabaseState.Deleted,
            phase: DedicatedDatabasePhase.Deleting,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )

    return doc.value
  }

  async exportDatabase(
    appid: string,
    filePath: string,
    user: UserWithKubeconfig,
  ) {
    const dedicatedDatabase = await this.findOne(appid)
    if (!dedicatedDatabase) {
      throw new Error(`database ${appid} not found`)
    }
    const connectionUri = await this.getConnectionUri(user, dedicatedDatabase)
    assert(connectionUri, `database ${appid} connection uri not found`)

    let syncId: ObjectId
    try {
      syncId = (
        await SystemDatabase.db
          .collection<DatabaseSyncRecord>('DatabaseSyncRecord')
          .insertOne({
            appid,
            uid: user._id,
            createdAt: new Date(),
            state: DatabaseSyncState.Processing,
            type: 'Export',
          })
      ).insertedId

      await p_exec(
        `mongodump --uri='${connectionUri}' --gzip --archive=${filePath}`,
      )
    } catch (error) {
      this.logger.error(`failed to export db ${appid}`, error)
      throw error
    } finally {
      await SystemDatabase.db
        .collection<DatabaseSyncRecord>('DatabaseSyncRecord')
        .updateOne(
          { _id: syncId },
          { $set: { state: DatabaseSyncState.Complete } },
        )
    }
  }

  async importDatabase(
    appid: string,
    dbName: string,
    filePath: string,
    user: UserWithKubeconfig,
  ): Promise<void> {
    const dedicatedDatabase = await this.findOne(appid)
    if (!dedicatedDatabase) {
      throw new Error(`database ${appid} not found`)
    }
    const connectionUri = await this.getConnectionUri(user, dedicatedDatabase)
    assert(connectionUri, `database ${appid} connection uri not found`)

    let syncId: ObjectId
    try {
      syncId = (
        await SystemDatabase.db
          .collection<DatabaseSyncRecord>('DatabaseSyncRecord')
          .insertOne({
            appid,
            uid: user._id,
            createdAt: new Date(),
            state: DatabaseSyncState.Processing,
            type: 'Import',
          })
      ).insertedId

      await p_exec(
        `mongorestore --uri='${connectionUri}' --gzip --archive='${filePath}' --nsFrom="${dbName}.*" --nsTo="sealaf-${appid}.*" -v --nsInclude="${dbName}.*"`,
      )

      await this.recoverFunctionsToSystemDatabase(appid, user._id)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`failed to import db to ${appid}`, error)
      throw error
    } finally {
      await SystemDatabase.db
        .collection<DatabaseSyncRecord>('DatabaseSyncRecord')
        .updateOne(
          { _id: syncId },
          { $set: { state: DatabaseSyncState.Complete } },
        )
    }
  }

  async recoverFunctionsToSystemDatabase(appid: string, uid: ObjectId) {
    const { db, client } = await this.findAndConnect(appid)

    try {
      const appFunctionCollection = db.collection(CN_PUBLISHED_FUNCTIONS)
      const appConfCollection = db.collection(CN_PUBLISHED_CONF)

      const functionsExist = await SystemDatabase.db
        .collection<CloudFunction>('CloudFunction')
        .countDocuments({ appid })

      if (functionsExist) return

      const funcs: CloudFunction[] = await appFunctionCollection
        .find<CloudFunction>({})
        .toArray()

      if (funcs.length === 0) return

      funcs.forEach((func) => {
        delete func._id
        func.appid = appid
        func.createdBy = uid
      })

      await SystemDatabase.db
        .collection<CloudFunction>('CloudFunction')
        .insertMany(funcs)

      // sync conf
      const conf = await SystemDatabase.db
        .collection<ApplicationConfiguration>('ApplicationConfiguration')
        .findOne({ appid })

      await appConfCollection.deleteMany({})
      await appConfCollection.insertOne(conf)
    } finally {
      await client.close()
    }
  }

  async databaseConnectionIsOk(appid: string): Promise<boolean> {
    try {
      const { client } = await this.findAndConnect(appid)
      const admin = client.db('admin')
      const replSetStatus = await admin.command({ replSetGetStatus: 1 })
      const members = replSetStatus.members
      const replicaSetOk: boolean = replSetStatus.ok === 1

      const healthyMembers = members.filter(
        (member: any) => member.health === 1,
      )

      const primary = healthyMembers.find(
        (member: any) => member.stateStr === 'PRIMARY',
      )

      const majorityCount = Math.ceil(members.length / 2)

      const isClusterHealthy =
        replicaSetOk && primary && healthyMembers.length >= majorityCount

      if (isClusterHealthy) {
        return true
      }

      return false
    } catch (error) {
      this.logger.verbose(
        `dedicatedDatabase health check failed ${appid}\n${error.message}`,
      )
      return false
    }
  }

  async checkDatabaseSyncLimit(uid: ObjectId) {
    const count = await SystemDatabase.db
      .collection<DatabaseSyncRecord>('DatabaseSyncRecord')
      .countDocuments({ uid, state: DatabaseSyncState.Processing })
    return count >= 2
  }
}
