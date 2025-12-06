# Fantasy Football Infrastructure

This directory contains Terraform configuration for provisioning AWS infrastructure.

## Architecture Overview

### Components:
- **VPC**: Isolated network with public and private subnets across 2 AZs
- **RDS PostgreSQL**: Database instance in private subnets
- **Lambda**: Serverless compute for API and data scraping
- **API Gateway**: REST API endpoint
- **NAT Gateway**: Allows Lambda to access ESPN API
- **Secrets Manager**: Secure storage for credentials
- **CloudWatch**: Logging and monitoring

### Network Design:
```
Internet
    │
    ├─► Internet Gateway
    │       │
    │       ├─► Public Subnet 1 (us-east-1a)
    │       │       └─► NAT Gateway
    │       │
    │       └─► Public Subnet 2 (us-east-1b)
    │
    └─► NAT Gateway
            │
            ├─► Private Subnet 1 (us-east-1a)
            │       ├─► Lambda Functions
            │       └─► RDS Primary
            │
            └─► Private Subnet 2 (us-east-1b)
                    └─► RDS Standby (Multi-AZ)
```

## Prerequisites

1. **AWS CLI** installed and configured
   ```bash
   aws configure
   ```

2. **Terraform** installed (v1.0+)
   ```bash
   # macOS
   brew install terraform
   
   # Linux
   wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
   unzip terraform_1.6.0_linux_amd64.zip
   sudo mv terraform /usr/local/bin/
   ```

3. **AWS Credentials** with appropriate permissions:
   - VPC management
   - RDS management
   - Lambda management
   - API Gateway management
   - Secrets Manager management
   - IAM role/policy management

## Deployment Steps

### 1. Configure Variables

Copy the example variables file:
```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:
```hcl
aws_region  = "us-east-1"
environment = "dev"
db_password = "YOUR_STRONG_PASSWORD_HERE"
```

### 2. Initialize Terraform

```bash
terraform init
```

This downloads required providers and sets up the backend.

### 3. Review the Plan

```bash
terraform plan
```

Review the resources that will be created. You should see:
- 1 VPC
- 4 Subnets (2 public, 2 private)
- 1 Internet Gateway
- 1 NAT Gateway
- 1 RDS instance
- Security groups
- IAM roles
- Secrets Manager secrets
- API Gateway

### 4. Apply the Configuration

```bash
terraform apply
```

Type `yes` when prompted. This will take 10-15 minutes (RDS creation is slow).

### 5. Save Outputs

After successful deployment, save the outputs:
```bash
terraform output > ../outputs.txt
```

Important outputs:
- `rds_endpoint`: Database connection string
- `api_gateway_url`: Your API base URL
- `db_credentials_secret_arn`: Secret ARN for database credentials
- `espn_credentials_secret_arn`: Secret ARN for ESPN credentials

## Post-Deployment Steps

### 1. Initialize Database Schema

Connect to RDS and run the schema:
```bash
# Get RDS endpoint
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)

# Connect using psql (you'll need psql installed)
psql -h $RDS_ENDPOINT -U postgres -d fantasy_football -f ../../database/schema.sql
```

### 2. Update ESPN Credentials

Update the ESPN credentials secret with your actual values:
```bash
aws secretsmanager update-secret \
  --secret-id fantasy-football-dev-espn-credentials \
  --secret-string '{
    "league_id": "YOUR_ESPN_LEAGUE_ID",
    "espn_s2": "YOUR_ESPN_S2_COOKIE",
    "swid": "YOUR_SWID_COOKIE"
  }'
```

To get ESPN cookies (if private league):
1. Log into ESPN Fantasy Football in your browser
2. Open Developer Tools (F12)
3. Go to Application/Storage → Cookies
4. Find `espn_s2` and `SWID` values

## Cost Estimates

### Monthly costs (us-east-1, approximate):

**Development Environment:**
- RDS db.t4g.micro (20GB): ~$15/month
- NAT Gateway: ~$32/month
- Lambda: ~$0 (free tier covers most dev usage)
- API Gateway: ~$0 (free tier covers most dev usage)
- Secrets Manager: ~$1/month
- **Total: ~$48/month**

**Cost Optimization Tips:**
- Stop RDS instance when not in use (saves ~$15/month)
- Use VPC endpoints instead of NAT Gateway (saves ~$32/month, but more complex)
- Use Aurora Serverless v2 for production (scales to zero)

## Maintenance

### View Current Infrastructure
```bash
terraform show
```

### Update Infrastructure
1. Modify `.tf` files
2. Run `terraform plan` to review changes
3. Run `terraform apply` to apply changes

### Destroy Infrastructure
```bash
terraform destroy
```

**WARNING**: This will delete all resources including the database!

## Security Notes

- Database is in private subnets (not publicly accessible)
- All credentials stored in AWS Secrets Manager
- Security groups restrict access (Lambda → RDS only)
- Encryption at rest enabled for RDS
- CloudWatch logging enabled for audit trail

## Troubleshooting

### RDS Connection Issues
- Verify Lambda security group is allowed in RDS security group
- Check RDS is in private subnets
- Verify NAT Gateway is working for outbound connections

### Lambda Can't Access Internet
- Verify NAT Gateway is in public subnet
- Check route table associations
- Verify Lambda is in private subnets

### Terraform State Issues
```bash
# Refresh state
terraform refresh

# Import existing resource (if needed)
terraform import aws_vpc.main vpc-xxxxx
```

## Next Steps

After infrastructure is deployed:
1. Deploy Lambda functions (FastAPI application)
2. Configure API Gateway routes
3. Test ESPN API integration
4. Set up CI/CD pipeline
