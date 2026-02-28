# ------------------------------------------------------------------------------
# EventBridge schedule for data sync Lambda
# Runs daily at 6 AM UTC (11 PM PT) — during NFL season, weekly stats
# are typically finalized by Tuesday morning.
# ------------------------------------------------------------------------------

resource "aws_cloudwatch_event_rule" "sync_schedule" {
  name                = "${var.project_name}-${var.environment}-sync-schedule"
  description         = "Daily trigger for ESPN player data sync"
  schedule_expression = "cron(0 6 ? * * *)"

  tags = { Name = "${var.project_name}-${var.environment}-sync-schedule" }
}

resource "aws_cloudwatch_event_target" "sync_lambda" {
  rule = aws_cloudwatch_event_rule.sync_schedule.name
  arn  = aws_lambda_function.functions["syncPlayerData"].arn
}

resource "aws_lambda_permission" "eventbridge_sync" {
  statement_id  = "AllowEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["syncPlayerData"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.sync_schedule.arn
}
