import { Condition } from 'src/region/cluster/types'
import { IRequest } from './interface'

export function isConditionTrue(type: string, conditions: Condition[] | any[]) {
  if (!conditions) return false

  for (const condition of conditions) {
    if (condition.type === type) {
      return condition.status === 'True'
    }
  }
  return false
}

export function GetClientIPFromRequest(req: IRequest) {
  // try to get ip from x-forwarded-for
  const ips_str = req.headers['x-forwarded-for'] as string
  if (ips_str) {
    const ips = ips_str.split(',')
    return ips[0]
  }

  // try to get ip from x-real-ip
  const ip = req.headers['x-real-ip'] as string
  if (ip) {
    return ip
  }

  return null
}
