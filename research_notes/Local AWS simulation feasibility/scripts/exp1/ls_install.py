import localstack.services.dynamodb.packages as p
p.DDBLOCAL_URL = "https://s3.us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.zip"
# use the system JDK 21 instead of downloading Temurin (not reachable)
p.DynamoDBLocalPackageInstaller._prepare_installation = lambda self, target: None
from localstack.services.dynamodb.packages import dynamodblocal_package
dynamodblocal_package.install()
print("installed", dynamodblocal_package.get_installed_dir())
