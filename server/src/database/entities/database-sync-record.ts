import { ObjectId } from 'mongodb'

export enum DatabaseSyncState {
  Processing = 'Processing',
  Complete = 'Complete',
}

export class DatabaseSyncRecord {
  _id?: ObjectId
  appid: string
  uid: ObjectId
  createdAt: Date
  type: 'Export' | 'Import'
  state: DatabaseSyncState
}
