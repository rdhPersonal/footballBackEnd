# ------------------------------------------------------------------------------
# Lambda function definitions
# Each function is bundled by esbuild into dist/<group>/<name>.js
# We zip each function individually for independent deployment.
# ------------------------------------------------------------------------------

locals {
  lambda_runtime = "nodejs20.x"
  lambda_timeout = 30
  lambda_memory  = 256

  lambda_env_vars = {
    DB_HOST     = aws_db_instance.main.address
    DB_PORT     = "5432"
    DB_NAME     = var.db_name
    DB_USER     = var.db_username
    DB_PASSWORD = var.db_password
    NODE_OPTIONS = "--enable-source-maps"
  }

  lambda_vpc_config = {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  lambda_functions = {
    getPlayers = {
      source_dir  = "players/getPlayers"
      handler     = "getPlayers.handler"
      description = "Search and list NFL players"
    }
    getPlayer = {
      source_dir  = "players/getPlayer"
      handler     = "getPlayer.handler"
      description = "Get single player detail"
    }
    getPlayerStats = {
      source_dir  = "players/getPlayerStats"
      handler     = "getPlayerStats.handler"
      description = "Get player weekly statistics"
    }
    getPlayerRosterHistory = {
      source_dir  = "players/getPlayerRosterHistory"
      handler     = "getPlayerRosterHistory.handler"
      description = "Get player roster history"
    }
    syncPlayerData = {
      source_dir  = "data-sync/syncPlayerData"
      handler     = "syncPlayerData.handler"
      description = "Scheduled ESPN data sync"
      timeout     = 900
      memory      = 512
    }
  }
}

# ------------------------------------------------------------------------------
# Archive: zip each function's dist output
# ------------------------------------------------------------------------------

data "archive_file" "lambda" {
  for_each = local.lambda_functions

  type        = "zip"
  source_dir  = "${path.module}/../dist/${each.value.source_dir}"
  output_path = "${path.module}/../dist/${each.key}.zip"
}

# ------------------------------------------------------------------------------
# Lambda Functions
# ------------------------------------------------------------------------------

resource "aws_lambda_function" "functions" {
  for_each = local.lambda_functions

  function_name = "${var.project_name}-${var.environment}-${each.key}"
  description   = each.value.description
  role          = aws_iam_role.lambda_exec.arn

  runtime     = local.lambda_runtime
  handler     = each.value.handler
  timeout     = lookup(each.value, "timeout", local.lambda_timeout)
  memory_size = lookup(each.value, "memory", local.lambda_memory)

  filename         = data.archive_file.lambda[each.key].output_path
  source_code_hash = data.archive_file.lambda[each.key].output_base64sha256

  environment {
    variables = local.lambda_env_vars
  }

  vpc_config {
    subnet_ids         = local.lambda_vpc_config.subnet_ids
    security_group_ids = local.lambda_vpc_config.security_group_ids
  }

  tags = { Name = "${var.project_name}-${var.environment}-${each.key}" }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.lambda_vpc,
  ]
}
