# footballBackEnd

AWS backend for NFL player statistics. Provides APIs for player data, team rosters, and weekly stats backed by PostgreSQL.

## Tech Stack

- **Infrastructure**: Terraform
- **Compute**: AWS Lambda (TypeScript / Node.js 20)
- **API**: API Gateway v2 (HTTP API) with Cognito JWT authorizer
- **Database**: RDS PostgreSQL (private VPC subnet)
- **Bastion**: EC2 instance for SSH tunneling to RDS
- **Data Source**: ESPN API

## Project Structure

```
terraform/          # Infrastructure as code (VPC, RDS, Lambda, API Gateway, Cognito)
src/
  functions/        # Lambda handler entry points
    players/        # Player query APIs
    data-sync/      # Scheduled data ingestion from ESPN
  shared/           # Shared code across all Lambdas
    types/          # TypeScript interfaces
    db/             # PostgreSQL client and query functions
    middleware/     # Error handling, response helpers
    external-api/   # ESPN API client
  migrations/       # SQL migration files
scripts/
  build.ts          # esbuild bundling for Lambda deployment
  migrate.ts        # Run DB migrations via bastion tunnel
  backfill.ts       # One-time historical data backfill (2023-2025)
  lib/              # Shared helpers for admin scripts
```

## Scripts

```bash
npm run build       # Bundle Lambda functions with esbuild
npm run typecheck   # TypeScript type checking
npm run migrate     # Run SQL migrations against RDS
npm run backfill    # Backfill historical player/stats data
```

## Database Credentials

The RDS master password is now managed by AWS Secrets Manager instead of a tracked Terraform variable.

- Lambda functions resolve the managed secret at runtime using `DB_INSTANCE_IDENTIFIER` plus IAM.
- Local admin scripts use your local AWS credentials plus either `DB_INSTANCE_IDENTIFIER` or `DB_SECRET_ARN`.
- The old raw `DB_PASSWORD` environment variable still works as a temporary fallback during the cutover, but it is no longer the recommended path.

For local scripts, export the DB instance identifier or the secret ARN:

```bash
export DB_INSTANCE_IDENTIFIER="football-backend-dev-db"

# optional after the first secret-managed apply
cd terraform
export DB_SECRET_ARN="$(terraform output -raw db_master_secret_arn)"
```

The resolved AWS DB metadata/secret and the shared Postgres pool are cached for 5 minutes by default to balance secret rotation support with cold-start overhead. Override that with `DB_CONFIG_CACHE_TTL_MS` if you need a shorter refresh window for local testing or faster credential rotation pickup.

## Bastion Host Access

The bastion host is an EC2 instance in the public subnet that provides SSH tunnel access to the RDS database in the private subnet. It is the only way to connect to the database for running migrations, backfills, and ad-hoc queries.

**Important: IP allowlisting.** The bastion security group restricts SSH (port 22) to a single IP address configured in `terraform/environments/dev.tfvars` as `bastion_ssh_cidr`. If your public IP changes (common with residential ISPs — can happen after a router reboot, power outage, or ISP lease renewal), you will be unable to SSH into the bastion until the security group is updated.

### Updating your IP

1. Find your current public IP:
   ```bash
   curl -s -4 ifconfig.me
   ```

2. Update `terraform/environments/dev.tfvars`:
   ```
   bastion_ssh_cidr = "<your-new-ip>/32"
   ```

3. Apply the change:
   ```bash
   cd terraform
   terraform apply -var-file=environments/dev.tfvars
   ```

   Terraform will update only the security group rule — no other resources are affected.

### Connecting to the bastion

```bash
# Direct SSH
ssh -i ~/.ssh/football-bastion.pem ec2-user@<bastion-public-ip>

# SSH tunnel to RDS (forwards local port 5432 to the RDS instance)
ssh -i ~/.ssh/football-bastion.pem -L 5432:<rds-endpoint>:5432 ec2-user@<bastion-public-ip> -N
```

With the tunnel running, connect to the database locally:
```bash
psql -h localhost -U footballadmin -d football
```

## API Contract Types

API contract DTOs (request/response types for all endpoints) live in `src/shared/types/api-contract.ts`. This is the canonical source of truth for the API contract.

The frontend (`footballFrontEnd`) maintains its own local copy of these types in `src/types/api-contract.ts`. When you add or change an endpoint here, the frontend copy must be updated manually to stay in sync.

### Sync checklist for contract changes

1. Update `src/shared/types/api-contract.ts` in this repo
2. Copy the changes to `footballFrontEnd/src/types/api-contract.ts`
3. Bump the `Last synced` date comment in both files
