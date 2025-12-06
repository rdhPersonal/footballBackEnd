#!/bin/bash
# Deploy the database initialization Lambda function

set -e

echo "Building Lambda deployment package..."

# Create deployment directory
rm -rf package
mkdir -p package

# Install dependencies
pip install -r requirements.txt -t package/

# Copy Lambda function
cp lambda_function.py package/

# Create ZIP file
cd package
zip -r ../db_init_lambda.zip .
cd ..

echo "Deployment package created: db_init_lambda.zip"
echo "Size: $(du -h db_init_lambda.zip | cut -f1)"
