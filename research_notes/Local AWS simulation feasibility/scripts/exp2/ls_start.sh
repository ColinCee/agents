#!/bin/bash
cd "$(dirname "$0")"
LOCALSTACK_DISABLE_EVENTS=1 SERVICES=events,sqs,lambda,dynamodb,dynamodbstreams,iam,sts exec lsvenv2/bin/python -m localstack.runtime.main > ls2.log 2>&1
