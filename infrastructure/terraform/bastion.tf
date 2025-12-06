# Bastion/Jump Host for Database Access
# This is a temporary EC2 instance for administrative access to RDS

# Get latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Security Group for Bastion
resource "aws_security_group" "bastion" {
  name        = "${var.project_name}-${var.environment}-bastion-sg"
  description = "Security group for bastion/jump host"
  vpc_id      = aws_vpc.main.id

  # SSH access from your IP
  ingress {
    description = "SSH from your IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # You can restrict this to your IP
  }

  # Allow all outbound
  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-bastion-sg"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Allow bastion to access RDS
resource "aws_security_group_rule" "rds_from_bastion" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.bastion.id
  security_group_id        = aws_security_group.rds.id
  description              = "PostgreSQL from bastion"
}

# Create a key pair for SSH access
resource "aws_key_pair" "bastion" {
  key_name   = "${var.project_name}-${var.environment}-bastion-key"
  public_key = var.bastion_public_key

  tags = {
    Name        = "${var.project_name}-${var.environment}-bastion-key"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Bastion EC2 Instance
resource "aws_instance" "bastion" {
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public[0].id
  key_name      = aws_key_pair.bastion.key_name

  vpc_security_group_ids = [aws_security_group.bastion.id]

  # Install PostgreSQL client and other tools
  user_data = <<-EOF
              #!/bin/bash
              yum update -y
              yum install -y postgresql15 git
              
              # Create a helper script for database connection
              cat > /home/ec2-user/connect-db.sh << 'SCRIPT'
              #!/bin/bash
              export PGPASSWORD='${var.db_password}'
              psql -h ${aws_db_instance.main.address} -U ${var.db_username} -d ${var.db_name}
              SCRIPT
              
              chmod +x /home/ec2-user/connect-db.sh
              chown ec2-user:ec2-user /home/ec2-user/connect-db.sh
              
              # Download schema file
              cat > /home/ec2-user/schema.sql << 'SCHEMA'
              ${file("../../database/schema.sql")}
              SCHEMA
              
              chown ec2-user:ec2-user /home/ec2-user/schema.sql
              
              # Create init script
              cat > /home/ec2-user/init-db.sh << 'INITSCRIPT'
              #!/bin/bash
              export PGPASSWORD='${var.db_password}'
              psql -h ${aws_db_instance.main.address} -U ${var.db_username} -d ${var.db_name} -f /home/ec2-user/schema.sql
              echo "Database schema initialized!"
              INITSCRIPT
              
              chmod +x /home/ec2-user/init-db.sh
              chown ec2-user:ec2-user /home/ec2-user/init-db.sh
              
              # Create README
              cat > /home/ec2-user/README.txt << 'README'
              Welcome to the Fantasy Football Bastion Host!
              
              Database connection details:
              - Host: ${aws_db_instance.main.address}
              - Port: 5432
              - Database: ${var.db_name}
              - Username: ${var.db_username}
              
              Quick commands:
              1. Connect to database: ./connect-db.sh
              2. Initialize schema: ./init-db.sh
              3. View schema file: cat schema.sql
              
              Manual connection:
              PGPASSWORD='${var.db_password}' psql -h ${aws_db_instance.main.address} -U ${var.db_username} -d ${var.db_name}
              README
              
              chown ec2-user:ec2-user /home/ec2-user/README.txt
              EOF

  tags = {
    Name        = "${var.project_name}-${var.environment}-bastion"
    Environment = var.environment
    Project     = var.project_name
  }

  depends_on = [aws_db_instance.main]
}

# Outputs
output "bastion_public_ip" {
  description = "Public IP of bastion host"
  value       = aws_instance.bastion.public_ip
}

output "bastion_ssh_command" {
  description = "SSH command to connect to bastion"
  value       = "ssh -i ~/.ssh/${var.project_name}-bastion.pem ec2-user@${aws_instance.bastion.public_ip}"
}

output "bastion_connection_info" {
  description = "Instructions for using the bastion host"
  value       = <<-EOT
    
    Bastion Host Created!
    
    1. SSH to bastion:
       ssh -i ~/.ssh/${var.project_name}-bastion.pem ec2-user@${aws_instance.bastion.public_ip}
    
    2. Once connected, initialize the database:
       ./init-db.sh
    
    3. Or connect to database interactively:
       ./connect-db.sh
    
    The schema.sql file is already on the bastion at ~/schema.sql
    
  EOT
}
