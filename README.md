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
```

## Scripts

```bash
npm run build       # Bundle Lambda functions with esbuild
npm run typecheck   # TypeScript type checking
npm run migrate     # Run SQL migrations against RDS
npm run backfill    # Backfill historical player/stats data
```

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

## Frontend/BFF TypeScript API Contract (library dependency)

This repo now exposes a shared workspace package: `@football/api-contract` at `packages/api-contract`.

### What to import

- `FootballApiContract` for endpoint -> method -> query/response/error mappings
- Endpoint DTOs (for example `GetPlayersResponse`, `GetPlayerStatsResponse`, `ApiErrorResponse`)

The backend re-exports this package from `src/shared/types/api-contract.ts` for backward compatibility.

### Build and deploy impact

- **Lambda runtime deploy artifact**: no direct impact today because this package is type-only contract metadata used at compile time.
- **CI/build**: yes, it is now part of repository dependency graph (workspace dependency), so installs and type checks include it.
- If runtime code is ever added to the package, bundle/deploy behavior should be re-evaluated.

### Versioning strategy

Recommended options:

1. **Internal lockstep (current)**
   - Keep package private + workspace-linked (`workspace:*`) while frontend and backend evolve together.
2. **Published package (when repos are independent)**
   - Publish `@football/api-contract` (GitHub Package Registry or npm).
   - Use **SemVer**:
     - patch: docs/non-breaking type tweaks
     - minor: additive DTO fields/endpoints
     - major: breaking field renames/removals/route contract changes
   - Have frontend/BFF pin a version range and update intentionally.

For production teams, pair SemVer with a changelog and a small contract-compatibility checklist in PRs.
