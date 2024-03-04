import { Injectable } from '@nestjs/common'
import { SystemDatabase } from 'src/system-database'
import { ResourceService } from './resource.service'
import { ObjectId } from 'mongodb'
import { ResourceType } from './entities/resource'
import { Decimal } from 'decimal.js'
import * as assert from 'assert'
import { CalculatePriceDto } from './dto/calculate-price.dto'

@Injectable()
export class BillingService {
  private readonly db = SystemDatabase.db

  constructor(
    private readonly resource: ResourceService,
  ) {}

  async calculatePrice(dto: CalculatePriceDto) {
    // get options by region id
    const options = await this.resource.findAllByRegionId(
      new ObjectId(dto.regionId),
    )

    const groupedOptions = this.resource.groupByType(options)
    assert(groupedOptions[ResourceType.CPU], 'cpu option not found')
    assert(groupedOptions[ResourceType.Memory], 'memory option not found')
    assert(
      groupedOptions[ResourceType.DedicatedDatabaseCPU],
      'dedicated database cpu option not found',
    )
    assert(
      groupedOptions[ResourceType.DedicatedDatabaseMemory],
      'dedicated database memory option not found',
    )
    assert(
      groupedOptions[ResourceType.DedicatedDatabaseCapacity],
      'dedicated database capacity option not found',
    )
    assert(
      groupedOptions[ResourceType.DedicatedDatabaseReplicas],
      'dedicated database replicas option not found',
    )

    // calculate cpu price
    const cpuOption = groupedOptions[ResourceType.CPU]
    const cpuPrice = new Decimal(cpuOption.price).mul(dto.cpu)

    // calculate memory price
    const memoryOption = groupedOptions[ResourceType.Memory]
    const memoryPrice = new Decimal(memoryOption.price).mul(dto.memory)

    const ddbCPUOption = groupedOptions[ResourceType.DedicatedDatabaseCPU]
    const ddbCPUPrice = dto.dedicatedDatabase
      ? new Decimal(ddbCPUOption.price)
          .mul(dto.dedicatedDatabase.cpu)
          .mul(dto.dedicatedDatabase.replicas)
      : new Decimal(0)

    const ddbMemoryOption = groupedOptions[ResourceType.DedicatedDatabaseMemory]
    const ddbMemoryPrice = dto.dedicatedDatabase
      ? new Decimal(ddbMemoryOption.price)
          .mul(dto.dedicatedDatabase.memory)
          .mul(dto.dedicatedDatabase.replicas)
      : new Decimal(0)

    const ddbCapacityOption =
      groupedOptions[ResourceType.DedicatedDatabaseCapacity]
    const ddbCapacityPrice = dto.dedicatedDatabase
      ? new Decimal(ddbCapacityOption.price)
          .mul(dto.dedicatedDatabase.capacity)
          .mul(dto.dedicatedDatabase.replicas)
      : new Decimal(0)

    const ddbTotalPrice = ddbCPUPrice.add(ddbMemoryPrice).add(ddbCapacityPrice)

    // calculate total price
    const totalPrice = cpuPrice
      .add(memoryPrice)
      .add(ddbTotalPrice)

    return {
      cpu: cpuPrice.toNumber(),
      memory: memoryPrice.toNumber(),
      dedicatedDatabase: {
        cpu: ddbCPUPrice.toNumber(),
        memory: ddbMemoryPrice.toNumber(),
        capacity: ddbCapacityPrice.toNumber(),
      },
      total: totalPrice.toNumber(),
    }
  }

}
