#!/usr/bin/env bash
set -euo pipefail

BUCKET_NAME="football-backend-tf-state"
LOCK_TABLE="football-backend-tf-lock"
REGION="us-west-2"

echo "Creating S3 bucket for Terraform state: ${BUCKET_NAME}"
aws s3api create-bucket \
  --bucket "${BUCKET_NAME}" \
  --region "${REGION}" \
  --create-bucket-configuration LocationConstraint="${REGION}"

echo "Enabling versioning on ${BUCKET_NAME}"
aws s3api put-bucket-versioning \
  --bucket "${BUCKET_NAME}" \
  --versioning-configuration Status=Enabled

echo "Enabling server-side encryption on ${BUCKET_NAME}"
aws s3api put-bucket-encryption \
  --bucket "${BUCKET_NAME}" \
  --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        },
        "BucketKeyEnabled": true
      }
    ]
  }'

echo "Blocking public access on ${BUCKET_NAME}"
aws s3api put-public-access-block \
  --bucket "${BUCKET_NAME}" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "Creating DynamoDB table for state locking: ${LOCK_TABLE}"
aws dynamodb create-table \
  --table-name "${LOCK_TABLE}" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "${REGION}"

echo ""
echo "Done! Terraform backend resources created:"
echo "  S3 bucket:      ${BUCKET_NAME}"
echo "  DynamoDB table:  ${LOCK_TABLE}"
echo "  Region:          ${REGION}"
echo ""
echo "You can now run: cd terraform && terraform init -var-file=environments/dev.tfvars"
