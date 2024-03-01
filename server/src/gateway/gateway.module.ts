import { Module } from '@nestjs/common'
import { RuntimeDomainService } from './runtime-domain.service'
import { HttpModule } from '@nestjs/axios'
import { RuntimeDomainTaskService } from './runtime-domain-task.service'
import { CertificateService } from './certificate.service'
import { RuntimeGatewayService } from './ingress/runtime-ingress.service'

@Module({
  imports: [HttpModule],
  providers: [
    RuntimeDomainService,
    RuntimeDomainTaskService,
    CertificateService,
    RuntimeGatewayService,
  ],
  exports: [RuntimeDomainService],
})
export class GatewayModule {}
