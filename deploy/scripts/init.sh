#!/bin/bash
set -e

mongodbUri=""

source etc/sealaf/.env

NAMESPACE=sealaf-system
kubectl create ns $NAMESPACE || true

echo "waiting for $certSecretName generated"
kubectl wait --for=condition=exists --timeout=120s secret/$certSecretName -n $NAMESPACE

gen_mongodbUri

MONGO_URI=$mongodb_uri
SERVER_JWT_SECRET=$(tr -cd 'a-z0-9' </dev/urandom | head -c32)
kubectl create secret generic sealaf-config \
  --from-literal=MONGO_URI=${MONGO_URI} \
  --from-literal=SERVER_JWT_SECRET=${SERVER_JWT_SECRET} || true

kubectl apply -f manifests/deploy.yaml \
  -f manifests/ingress.yaml \
  -f manifests/appcr.yaml

function gen_mongodbUri() {
  # if mongodbUri is empty then create mongodb and gen mongodb uri
  if [ -z "$mongodbUri" ]; then
    echo "no mongodb uri found, create mongodb and gen mongodb uri"
    kubectl apply -f manifests/mongodb.yaml
    echo "waiting for mongodb secret generated"
    message="Waiting for MongoDB ready"
    # if there is no sealos-mongodb-conn-credential secret then wait for mongodb ready
    while [ -z "$(kubectl get secret -n $NAMESPACE sealaf-mongodb-conn-credential 2>/dev/null)" ]; do
      echo -ne "\r$message   \e[K"
      sleep 0.5
      echo -ne "\r$message .  \e[K"
      sleep 0.5
      echo -ne "\r$message .. \e[K"
      sleep 0.5
      echo -ne "\r$message ...\e[K"
      sleep 0.5
    done
    echo "mongodb secret has been generated successfully."
    chmod +x scripts/gen-mongodb-uri.sh
    mongodbUri=$(scripts/gen-mongodb-uri.sh)
  fi
}
