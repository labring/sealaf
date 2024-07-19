import { Cron, CronExpression } from '@nestjs/schedule'
import { SystemDatabase } from 'src/system-database'
import {
  DedicatedDatabase,
  DedicatedDatabasePhase,
  DedicatedDatabaseState,
} from '../entities/dedicated-database'
import { DedicatedDatabaseService } from './dedicated-database.service'
import { ServerConfig, TASK_LOCK_INIT_TIME } from 'src/constants'
import { Injectable, Logger } from '@nestjs/common'
import { RegionService } from 'src/region/region.service'
import { ClusterService } from 'src/region/cluster/cluster.service'

@Injectable()
export class DedicatedDatabaseTaskService {
  private readonly logger = new Logger(DedicatedDatabaseTaskService.name)
  private readonly lockTimeout = 15 // in seconds
  private readonly db = SystemDatabase.db

  constructor(
    private readonly regionService: RegionService,
    private readonly clusterService: ClusterService,
    private readonly dbService: DedicatedDatabaseService,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async tick() {
    if (ServerConfig.DISABLED_INSTANCE_TASK) {
      return
    }

    this.handleDeletingPhase().catch((err) => {
      this.logger.error(err)
    })
    this.handleStoppingPhase().catch((err) => {
      this.logger.error(err)
    })
    this.handleStartingPhase().catch((err) => {
      this.logger.error(err)
    })
    this.handleDeletedState().catch((err) => {
      this.logger.error(err)
    })
    this.handleStoppedState().catch((err) => {
      this.logger.error(err)
    })
    this.handleRestartingState().catch((err) => {
      this.logger.error(err)
    })
    this.handleRunningState().catch((err) => {
      this.logger.error(err)
    })
  }

  async handleStartingPhase() {
    const res = await this.db
      .collection<DedicatedDatabase>('DedicatedDatabase')
      .findOneAndUpdate(
        {
          state: { $ne: DedicatedDatabaseState.Restarting },
          phase: DedicatedDatabasePhase.Starting,
          lockedAt: { $lt: new Date(Date.now() - this.lockTimeout * 1000) },
        },
        { $set: { lockedAt: new Date() } },
        { sort: { lockedAt: 1, updatedAt: 1 }, returnDocument: 'after' },
      )

    if (!res.value) return
    const data = res.value
    const appid = data.appid

    const region = await this.regionService.findByAppId(appid)
    const user = await this.clusterService.getUserByAppid(appid)
    let manifest = await this.dbService.getDeployManifest(region, user, appid)

    const waitingTime = Date.now() - data.updatedAt.getTime()

    if (!manifest || manifest.spec.componentSpecs[0].replicas === 0) {
      await this.dbService.applyDeployManifest(region, user, appid)
      await this.relock(appid, waitingTime)
      return
    }

    const connectionOk = await this.dbService.databaseConnectionIsOk(appid)

    manifest = await this.dbService.getDeployManifest(region, user, appid)
    const unavailable = manifest?.status?.phase !== 'Running'

    if (unavailable && !connectionOk) {
      await this.relock(appid, waitingTime)
      return
    }

    await this.db.collection<DedicatedDatabase>('DedicatedDatabase').updateOne(
      {
        appid,
        phase: DedicatedDatabasePhase.Starting,
      },
      {
        $set: {
          state: DedicatedDatabaseState.Running,
          phase: DedicatedDatabasePhase.Started,
          lockedAt: TASK_LOCK_INIT_TIME,
          updatedAt: new Date(),
        },
      },
    )

    this.logger.debug(`dedicated database ${appid} updated to phase started`)
  }

  async handleDeletingPhase() {
    const res = await this.db
      .collection<DedicatedDatabase>('DedicatedDatabase')
      .findOneAndUpdate(
        {
          phase: DedicatedDatabasePhase.Deleting,
          lockedAt: {
            $lt: new Date(Date.now() - this.lockTimeout * 1000),
          },
        },
        { $set: { lockedAt: new Date() } },
        { sort: { lockedAt: 1, updatedAt: 1 }, returnDocument: 'after' },
      )

    if (!res.value) return
    const data = res.value
    const appid = data.appid

    const waitingTime = Date.now() - data.updatedAt.getTime()

    const region = await this.regionService.findByAppId(appid)
    const user = await this.clusterService.getUserByAppid(appid)
    const manifest = await this.dbService.getDeployManifest(region, user, appid)

    if (manifest) {
      await this.dbService.deleteDeployManifest(region, user, appid)
      await this.relock(appid, waitingTime)
      return
    }

    await this.db.collection<DedicatedDatabase>('DedicatedDatabase').updateOne(
      {
        appid,
        phase: DedicatedDatabasePhase.Deleting,
      },
      {
        $set: {
          phase: DedicatedDatabasePhase.Deleted,
          lockedAt: TASK_LOCK_INIT_TIME,
          updatedAt: new Date(),
        },
      },
    )
  }

  async handleStoppingPhase() {
    const res = await this.db
      .collection<DedicatedDatabase>('DedicatedDatabase')
      .findOneAndUpdate(
        {
          phase: DedicatedDatabasePhase.Stopping,
          lockedAt: {
            $lt: new Date(Date.now() - this.lockTimeout * 1000),
          },
        },
        {
          $set: {
            lockedAt: new Date(),
          },
        },
      )

    if (!res.value) return
    const data = res.value
    const appid = data.appid

    const region = await this.regionService.findByAppId(appid)
    const user = await this.clusterService.getUserByAppid(appid)
    const waitingTime = Date.now() - data.updatedAt.getTime()

    const manifest = await this.dbService.getDeployManifest(region, user, appid)

    if (!manifest) {
      throw new Error(`stop dedicated database ${appid} manifest not found`)
    }

    const stopped =
      manifest?.status?.phase === 'Stopped' &&
      manifest.spec.componentSpecs[0].replicas === 0

    if (manifest.spec.componentSpecs[0].replicas !== 0) {
      await this.dbService.applyDeployManifest(region, user, appid, {
        replicas: 0,
      })
      await this.relock(appid, waitingTime)
      return
    }

    if (!stopped) {
      await this.relock(appid, waitingTime)
      return
    }

    await this.db.collection<DedicatedDatabase>('DedicatedDatabase').updateOne(
      {
        appid: data.appid,
        phase: DedicatedDatabasePhase.Stopping,
      },
      {
        $set: {
          phase: DedicatedDatabasePhase.Stopped,
          lockedAt: TASK_LOCK_INIT_TIME,
          updatedAt: new Date(),
        },
      },
    )

    this.logger.log(`dedicated database ${appid} updated to phase Stopped`)
  }

  async handleDeletedState() {
    const db = SystemDatabase.db

    await db.collection<DedicatedDatabase>('DedicatedDatabase').updateMany(
      {
        state: DedicatedDatabaseState.Deleted,
        phase: {
          $in: [DedicatedDatabasePhase.Started, DedicatedDatabasePhase.Stopped],
        },
      },
      {
        $set: {
          phase: DedicatedDatabasePhase.Deleting,
          lockedAt: TASK_LOCK_INIT_TIME,
        },
      },
    )

    await db.collection<DedicatedDatabase>('DedicatedDatabase').deleteMany({
      state: DedicatedDatabaseState.Deleted,
      phase: DedicatedDatabasePhase.Deleted,
    })
  }

  async handleStoppedState() {
    const db = SystemDatabase.db

    await db.collection<DedicatedDatabase>('DedicatedDatabase').updateMany(
      {
        state: DedicatedDatabaseState.Stopped,
        phase: {
          $in: [DedicatedDatabasePhase.Started],
        },
      },
      {
        $set: {
          phase: DedicatedDatabasePhase.Stopping,
          lockedAt: TASK_LOCK_INIT_TIME,
        },
      },
    )
  }

  async handleRunningState() {
    const db = SystemDatabase.db

    await db.collection<DedicatedDatabase>('DedicatedDatabase').updateMany(
      {
        state: DedicatedDatabaseState.Running,
        phase: {
          $in: [DedicatedDatabasePhase.Stopped],
        },
      },
      {
        $set: {
          phase: DedicatedDatabasePhase.Starting,
          lockedAt: TASK_LOCK_INIT_TIME,
        },
      },
    )
  }

  async handleRestartingState() {
    const db = SystemDatabase.db

    const res = await db
      .collection<DedicatedDatabase>('DedicatedDatabase')
      .findOneAndUpdate(
        {
          state: DedicatedDatabaseState.Restarting,
          phase: DedicatedDatabasePhase.Started,
          lockedAt: { $lt: new Date(Date.now() - 1000 * this.lockTimeout) },
        },
        { $set: { lockedAt: new Date() } },
        { sort: { lockedAt: 1, updatedAt: 1 }, returnDocument: 'after' },
      )

    if (!res.value) return
    const ddb = res.value
    const waitingTime = Date.now() - ddb.updatedAt.getTime()

    const appid = ddb.appid
    const region = await this.regionService.findByAppId(appid)
    const user = await this.clusterService.getUserByAppid(appid)

    const isDeployManifestChanged =
      await this.dbService.isDeployManifestChanged(region, user, appid)

    if (isDeployManifestChanged) {
      await this.dbService.applyDeployManifest(region, user, appid)
      await db.collection<DedicatedDatabase>('DedicatedDatabase').updateOne(
        {
          appid: appid,
        },
        {
          $set: {
            state: DedicatedDatabaseState.Running,
            phase: DedicatedDatabasePhase.Starting,
            lockedAt: TASK_LOCK_INIT_TIME,
            updatedAt: new Date(),
          },
        },
      )
      return
    }

    const OpsRequestManifest =
      await this.dbService.getKubeBlockOpsRequestManifest(region, user, appid)

    if (!OpsRequestManifest) {
      await this.dbService.applyKubeBlockOpsRequestManifest(region, user, appid)
      await this.relock(appid, waitingTime)
      return
    }

    const ddbDeployManifest = await this.dbService.getDeployManifest(
      region,
      user,
      appid,
    )

    if (!ddbDeployManifest) {
      await this.relock(appid, waitingTime)
      return
    }

    const isRestartSuccessful =
      ddbDeployManifest?.status?.phase === 'Running' &&
      OpsRequestManifest?.status?.phase === 'Succeed'

    if (isRestartSuccessful) {
      await this.dbService.deleteKubeBlockOpsManifest(region, user, appid)
      await db.collection<DedicatedDatabase>('DedicatedDatabase').updateOne(
        {
          appid: appid,
        },
        {
          $set: {
            state: DedicatedDatabaseState.Running,
            phase: DedicatedDatabasePhase.Started,
            lockedAt: TASK_LOCK_INIT_TIME,
            updatedAt: new Date(),
          },
        },
      )
    }
  }

  /**
   * Relock application by appid, lockedTime is in milliseconds
   */
  async relock(appid: string, lockedTime = 0) {
    if (lockedTime <= 2 * 60 * 1000) {
      lockedTime = Math.ceil(lockedTime / 10)
    }

    if (lockedTime > 2 * 60 * 1000) {
      lockedTime = this.lockTimeout * 1000
    }

    const db = SystemDatabase.db
    const lockedAt = new Date(Date.now() - 1000 * this.lockTimeout + lockedTime)
    await db
      .collection<DedicatedDatabase>('DedicatedDatabase')
      .updateOne({ appid: appid }, { $set: { lockedAt } })
  }

  private getHourTime() {
    const latestTime = new Date()
    latestTime.setMinutes(0)
    latestTime.setSeconds(0)
    latestTime.setMilliseconds(0)
    latestTime.setHours(latestTime.getHours())
    return latestTime
  }
}
