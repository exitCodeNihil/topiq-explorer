#!/bin/bash
# Script to create SCRAM users in Kafka
# This script is run by the kafka-scram-init container

set -e

ZOOKEEPER_HOST=${ZOOKEEPER_HOST:-zookeeper:2181}

echo "Creating SCRAM-SHA-256 user: admin"
kafka-configs --zookeeper $ZOOKEEPER_HOST \
    --alter \
    --add-config 'SCRAM-SHA-256=[iterations=8192,password=admin-secret]' \
    --entity-type users \
    --entity-name admin

echo "Creating SCRAM-SHA-256 user: client"
kafka-configs --zookeeper $ZOOKEEPER_HOST \
    --alter \
    --add-config 'SCRAM-SHA-256=[iterations=8192,password=client-secret]' \
    --entity-type users \
    --entity-name client

echo "SCRAM users created successfully!"
