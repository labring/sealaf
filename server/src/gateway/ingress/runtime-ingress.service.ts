import { V1Ingress, V1IngressTLS } from '@kubernetes/client-node'
import { Injectable, Logger } from '@nestjs/common'
import { LABEL_KEY_APP_ID } from 'src/constants'
import { ClusterService } from 'src/region/cluster/cluster.service'
import { Region } from 'src/region/entities/region'
import { RuntimeDomain } from '../entities/runtime-domain'
import { CertificateService } from '../certificate.service'

@Injectable()
export class RuntimeGatewayService {
  private readonly logger = new Logger(RuntimeGatewayService.name)
  constructor(
    private readonly clusterService: ClusterService,
    private readonly certificate: CertificateService,
  ) {}

  getIngressName(domain: RuntimeDomain) {
    return `sealaf-${domain.appid}`
  }

  async getIngress(domain: RuntimeDomain) {
    // use appid as ingress name of runtime directly
    const appid = domain.appid
    const name = this.getIngressName(domain)
    const user = await this.clusterService.getUserByAppid(appid)

    const ingress = await this.clusterService.getIngress(user, name)

    return ingress
  }

  async createIngress(region: Region, runtimeDomain: RuntimeDomain) {
    const appid = runtimeDomain.appid
    const user = await this.clusterService.getUserByAppid(appid)
    const namespace = user.namespace

    // use appid as ingress name of runtime directly
    const name = this.getIngressName(runtimeDomain)
    const hosts = [runtimeDomain.domain]
    if (runtimeDomain.customDomain) {
      hosts.push(runtimeDomain.customDomain)
    }

    // build rules
    const backend = { service: { name, port: { number: 8000 } } }
    const rules = hosts.map((host) => {
      return {
        host,
        http: { paths: [{ path: '/', pathType: 'Prefix', backend }] },
      }
    })

    // build tls
    const tls: Array<V1IngressTLS> = []
    if (region.gatewayConf.tls.enabled) {
      // add wildcardDomain tls
      if (region.gatewayConf.tls.wildcardCertificateSecretName) {
        const secretName = region.gatewayConf.tls.wildcardCertificateSecretName
        tls.push({ secretName, hosts: [runtimeDomain.domain] })
      }

      // add customDomain tls
      if (runtimeDomain.customDomain) {
        const secretName =
          this.certificate.getRuntimeCertificateName(runtimeDomain)
        tls.push({ secretName, hosts: [runtimeDomain.customDomain] })
      }
    }

    // create ingress
    const ingressClassName = region.gatewayConf.driver
    const ingressBody: V1Ingress = {
      metadata: {
        name,
        namespace,
        labels: {
          [LABEL_KEY_APP_ID]: appid,
          'sealaf.dev/ingress.type': 'runtime',
        },
        annotations: {
          // apisix ingress annotations
          'k8s.apisix.apache.org/enable-websocket': 'true',

          // k8s nginx ingress annotations
          // websocket is enabled by default in k8s nginx ingress
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '300',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '300',
          'nginx.ingress.kubernetes.io/proxy-body-size': '0',
          'nginx.ingress.kubernetes.io/proxy-buffer-size': '8192k',
          'nginx.ingress.kubernetes.io/server-snippet':
            'client_header_buffer_size 8192k;\nlarge_client_header_buffers 8 512k;\n',
        },
      },
      spec: { ingressClassName, rules, tls },
    }

    const res = await this.clusterService.createIngress(user, ingressBody)
    return res
  }

  async deleteIngress(domain: RuntimeDomain) {
    const appid = domain.appid
    const user = await this.clusterService.getUserByAppid(appid)
    const name = this.getIngressName(domain)

    // delete ingress
    const res = await this.clusterService.deleteIngress(user, name)
    return res
  }
}
