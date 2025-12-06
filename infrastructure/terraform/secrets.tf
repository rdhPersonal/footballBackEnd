# Secrets Manager for Database Credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.project_name}-${var.environment}-db-credentials"
  description = "Database credentials for RDS PostgreSQL"

  tags = {
    Name        = "${var.project_name}-${var.environment}-db-credentials"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    dbname   = var.db_name
    engine   = "postgres"
  })
}

# Secrets Manager for ESPN Credentials
resource "aws_secretsmanager_secret" "espn_credentials" {
  name        = "${var.project_name}-${var.environment}-espn-credentials"
  description = "ESPN API credentials (league ID and cookies)"

  tags = {
    Name        = "${var.project_name}-${var.environment}-espn-credentials"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Placeholder version - you'll update this manually with actual ESPN credentials
resource "aws_secretsmanager_secret_version" "espn_credentials" {
  secret_id = aws_secretsmanager_secret.espn_credentials.id
  secret_string = jsonencode({
    league_id = "REPLACE_WITH_YOUR_LEAGUE_ID"
    espn_s2   = "REPLACE_WITH_ESPN_S2_COOKIE"
    swid      = "REPLACE_WITH_SWID_COOKIE"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
