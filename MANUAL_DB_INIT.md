# Manual Database Initialization Steps

Since the RDS instance is in a private subnet (for security), here are the simplest ways to initialize the schema:

## Option 1: Use AWS CloudShell (Easiest)

1. Open AWS CloudShell in the AWS Console (icon in top right)
2. Install PostgreSQL client:
   ```bash
   sudo yum install -y postgresql15
   ```
3. Upload the schema file or copy/paste it
4. Run:
   ```bash
   PGPASSWORD='lkajs098));sd333' psql \
     -h fantasy-football-dev-db.cpapglostuzx.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d fantasy_football \
     -f schema.sql
   ```

## Option 2: Use AWS RDS Query Editor

1. Go to RDS Console → Query Editor
2. Connect to `fantasy-football-dev-db`
3. Use credentials from Secrets Manager or:
   - Username: `postgres`
   - Password: `lkajs098));sd333`
4. Copy/paste the schema SQL and execute

## Option 3: Create Temporary Bastion Host

Run from this directory:
```bash
cd infrastructure/terraform
terraform apply -target=aws_instance.bastion
# SSH to bastion, then connect to RDS from there
```

## Option 4: Temporarily Make RDS Public (Not Recommended)

The RDS is already set to `publicly_accessible = true` but it's in private subnets.
To make it truly accessible, we'd need to:
1. Create new RDS in public subnet (requires destroy/recreate)
2. Not recommended for security reasons

## Recommended: Option 1 (AWS CloudShell)

It's the fastest and doesn't require any infrastructure changes.
