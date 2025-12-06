#!/bin/bash
set -e

echo "Building Lambda deployment package for FastAPI..."

# Clean up old package
rm -f lambda_api.zip
rm -rf lambda_package

# Create package directory
mkdir -p lambda_package

# Install dependencies with platform-specific wheels for Lambda (Amazon Linux 2)
echo "Installing Python dependencies for Lambda runtime..."
pip install -r requirements.txt -t lambda_package/ --upgrade \
    --platform manylinux2014_x86_64 \
    --only-binary=:all: \
    --python-version 3.11

# Copy source code
echo "Copying source code..."
cp -r src lambda_package/

# Create zip file
echo "Creating deployment package..."
cd lambda_package
zip -r ../lambda_api.zip . -q
cd ..

# Clean up
rm -rf lambda_package

echo "Deployment package created: lambda_api.zip"
ls -lh lambda_api.zip
