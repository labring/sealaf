import { Injectable, Logger } from '@nestjs/common'
import { MongoClient } from 'mongodb'
import * as assert from 'node:assert'

@Injectable()
export class MongoService {
  private readonly logger = new Logger(MongoService.name)

  /**
   * Connect to database
   */
  async connectDatabase(connectionUri: string, dbName?: string) {
    assert(connectionUri, 'Database connection uri is required')

    const client = new MongoClient(connectionUri)
    try {
      this.logger.verbose(`Connecting to database ${dbName}`)
      await client.connect()
      this.logger.log(`Connected to database ${dbName}`)
      return client
    } catch {
      this.logger.error(`Failed to connect to database ${dbName}`)
      await client.close()
      return null
    }
  }
}
