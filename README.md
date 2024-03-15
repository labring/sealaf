## What is Sealaf?

Sealaf is a product that deeply integrates [Laf](https://github.com/labring/laf) and [Sealos](https://github.com/labring/sealos). As a function computing application of Sealos, it can leverage the powerful BaaS (Backend as a Service) capabilities provided by Sealos, offering users out-of-the-box development capabilities.

## How to build

```bash
# in web directory
docker build -t docker.io/zacharywin/sealaf-web:latest -f Dockerfile .

# in server directory
docker build -t docker.io/zacharywin/sealaf-server:latest -f Dockerfile .

# in deploy directory
sealos build -t docker.io/zacharywin/sealaf:latest --platform linux/amd64 -f Kubefile  .
```

## How to deploy

```bash
sealos run docker.io/zacharywin/sealaf:latest --env cloudDomain="127.0.0.1.nip.io"
```
