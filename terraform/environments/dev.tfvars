environment   = "dev"
aws_region    = "us-west-2"

# Bastion
# NOTE: bastion_ssh_cidr must be your current public IPv4 address with a /32 mask.
# If your IP changes (common with residential ISPs), update this value and run
# terraform apply to restore SSH access. Find your IP with: curl -s -4 ifconfig.me
bastion_ssh_cidr      = "***REDACTED_IP***/32"
bastion_key_name      = "football-bastion"
bastion_instance_type = "t3.micro"

# RDS
db_name           = "football"
db_username       = "footballadmin"
db_password       = "***REDACTED_DB_PASSWORD***"
db_instance_class = "db.t4g.micro"
