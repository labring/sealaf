#!/bin/bash
namespace="sealaf-system"
secret_name="sealaf-mongodb-account-root"

secret_data=$(kubectl get secret -n $namespace $secret_name -o go-template='{{range $k,$v := .data}}{{printf "%s: " $k}}{{if not $v}}{{$v}}{{else}}{{$v | base64decode}}{{end}}{{"\n"}}{{end}}')

password=$(echo "$secret_data" | awk -F': ' '/password/ {print $2}')
username=$(echo "$secret_data" | awk -F': ' '/username/ {print $2}')

# cluster base name for system db
name="sealaf-mongodb"
host="$name-mongodb.$namespace.svc"
port=27017

mongodb_uri="mongodb://$username:$password@$host:$port/sys_db?authSource=admin&replicaSet=$name-mongodb&w=majority"

echo "$mongodb_uri"