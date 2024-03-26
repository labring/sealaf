import { Injectable, Logger } from '@nestjs/common'
import { LABEL_KEY_APP_ID } from 'src/constants'
import { ClusterService } from 'src/region/cluster/cluster.service'
import { RuntimeDomain } from './entities/runtime-domain'
import { User } from 'src/user/entities/user'

// This class handles the creation and deletion of website domain certificates
@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name)
  constructor(private readonly clusterService: ClusterService) {}

  getRuntimeCertificateName(domain: RuntimeDomain) {
    return `sealaf-${domain.appid}-runtime-custom-domain`
  }

  // Read a certificate for app custom domain using cert-manager.io CRD
  async getRuntimeCertificate(user: User, runtimeDomain: RuntimeDomain) {
    const name = this.getRuntimeCertificateName(runtimeDomain)
    return await this.read(user, name)
  }

  // Create a certificate for app custom domain using cert-manager.io CRD
  async createRuntimeCertificate(user: User, runtimeDomain: RuntimeDomain) {
    const name = this.getRuntimeCertificateName(runtimeDomain)
    return await this.create(user, name, runtimeDomain.customDomain, {
      'cloud.sealos.io/app-deploy-manager': `sealaf-${runtimeDomain.appid}`,
      'sealaf.dev/runtime-domain': runtimeDomain.customDomain,
      [LABEL_KEY_APP_ID]: runtimeDomain.appid,
    })
  }

  // Delete a certificate for app custom domain using cert-manager.io CRD
  async deleteRuntimeCertificate(user: User, runtimeDomain: RuntimeDomain) {
    const name = this.getRuntimeCertificateName(runtimeDomain)
    return await this.remove(user, name)
  }

  private async read(user: User, name: string) {
    try {
      const api = this.clusterService.makeCustomObjectApi()
      const res = await api.getNamespacedCustomObject(
        'cert-manager.io',
        'v1',
        user.namespace,
        'certificates',
        name,
      )

      return res.body
    } catch (err) {
      if (err?.response?.body?.reason === 'NotFound') return null
      this.logger.error(err)
      this.logger.error(err?.response?.body)
      throw err
    }
  }

  private async create(
    user: User,
    name: string,
    domain: string,
    labels: Record<string, string>,
  ) {
    const api = this.clusterService.makeObjectApi()
    await api
      .create({
        apiVersion: 'cert-manager.io/v1',
        kind: 'Issuer',
        // Set the metadata for the Certificate resource
        metadata: {
          name,
          namespace: user.namespace,
          labels,
        },
        // Define the specification for the Certificate resource
        spec: {
          acme: {
            server: 'https://acme-v02.api.letsencrypt.org/directory',
            email: 'admin@sealos.io',
            privateKeySecretRef: {
              name: 'letsencrypt-prod',
            },
            solvers: [
              {
                http01: {
                  ingress: {
                    class: 'nginx',
                    serviceType: 'ClusterIP',
                  },
                },
              },
            ],
          },
        },
      })
      .catch((err) => {
        if (
          err.response &&
          JSON.stringify(err.response).includes('already exists')
        ) {
          this.logger.warn(`certificate issuer ${name} already exists`)
          return
        }
        throw err
      })

    const res = await api
      .create({
        apiVersion: 'cert-manager.io/v1',
        kind: 'Certificate',
        // Set the metadata for the Certificate resource
        metadata: {
          name,
          namespace: user.namespace,
          labels,
        },
        // Define the specification for the Certificate resource
        spec: {
          secretName: name,
          dnsNames: [domain],
          issuerRef: {
            name,
            kind: 'Issuer',
          },
        },
      })
      .catch((err) => {
        if (
          err.response &&
          JSON.stringify(err.response).includes('already exists')
        ) {
          this.logger.warn(`certificate ${name} already exists`)
          return { body: null }
        }
        throw err
      })
    return res.body
  }

  private async remove(user: User, name: string) {
    const api = this.clusterService.makeObjectApi()

    // Make a request to delete the Certificate resource
    const res = await api.delete({
      apiVersion: 'cert-manager.io/v1',
      kind: 'Certificate',
      metadata: {
        name,
        namespace: user.namespace,
      },
    })

    // GC the secret
    await api
      .delete({
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
          name,
          namespace: user.namespace,
        },
      })
      // Ignore errors, as the secret may not exist
      .catch((err) => {
        this.logger.error(err)
        this.logger.error(err?.response?.body)
      })

    return res.body
  }
}
