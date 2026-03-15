variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "football-backend"
}

# VPC

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# Bastion

variable "bastion_ssh_cidr" {
  description = "CIDR block allowed to SSH into the bastion host (your public IPv4 with /32 mask, e.g. 203.0.113.42/32). Must be updated if your IP changes — residential ISPs reassign IPs periodically."
  type        = string
}

variable "bastion_key_name" {
  description = "Name of an existing EC2 key pair for SSH access to the bastion host"
  type        = string
}

variable "bastion_instance_type" {
  description = "EC2 instance type for the bastion host"
  type        = string
  default     = "t3.micro"
}

# RDS (used in Phase 2, defined here so variables.tf is the single source)

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "football"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "footballadmin"
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

# Cognito (Phase 4)

variable "cognito_domain_prefix" {
  description = "Prefix for the Cognito hosted UI domain (e.g. 'football-dev' -> football-dev.auth.us-west-2.amazoncognito.com)"
  type        = string
}

variable "cognito_callback_urls" {
  description = "Allowed callback URLs for the Cognito app client (e.g. frontend /api/auth/callback)"
  type        = list(string)
}

variable "cognito_logout_urls" {
  description = "Allowed logout URLs for the Cognito app client"
  type        = list(string)
}

# Frontend (Phase 4)

variable "frontend_urls" {
  description = "Allowed frontend origin URLs for API Gateway CORS"
  type        = list(string)
}
