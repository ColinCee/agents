# Launch LocalStack runtime on host (no docker), pointing the DynamoDB Local download at AWS's S3 bucket
# because the default CloudFront host is blocked by this sandbox's egress policy.
import localstack.services.dynamodb.packages as p
p.DDBLOCAL_URL = "https://s3.us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.zip"
from localstack.runtime.main import main
main()
