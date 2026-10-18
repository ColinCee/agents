#!/bin/bash
# usage: start_ls.sh <logfile> [extra env assignments via environment]
cd "$(dirname "$0")"; . venv/bin/activate
GATEWAY_LISTEN=127.0.0.1:4577 LOCALSTACK_ACKNOWLEDGE_ACCOUNT_REQUIREMENT=1 LOCALSTACK_DISABLE_EVENTS=1 SERVICES=dynamodb,sqs,lambda setsid nohup python ls_launch.py > ${1:-ls.log} 2>&1 < /dev/null &
echo $! > ls.pid
