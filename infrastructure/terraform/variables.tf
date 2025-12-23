variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "fantasy-football"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "fantasy_football"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro" # Free tier eligible
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for RDS"
  type        = bool
  default     = false # Set to true for production
}

variable "backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "bastion_public_key" {
  description = "SSH public key for bastion host access"
  type        = string
  default     = ""
}

# Cognito Variables
variable "admin_email" {
  description = "Admin user email for Cognito"
  type        = string
  sensitive   = true
}

variable "admin_temp_password" {
  description = "Temporary password for admin user"
  type        = string
  default     = "TempPass123!"
  sensitive   = true
}
