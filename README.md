# Fantasy Football AWS Backend

A comprehensive fantasy football data management system built on AWS, featuring NFL data integration, ESPN fantasy league synchronization, and a complete REST API for fantasy football applications.

## 🏈 Features

### NFL Data Management
- **Complete NFL Data Pipeline**: Teams, players, games, and player statistics
- **ESPN Integration**: Automated data fetching from ESPN APIs
- **Real-time Stats**: Player game statistics with fantasy scoring
- **Season Coverage**: Full 2025 NFL season data

### Fantasy League Management
- **ESPN League Sync**: Import your private ESPN fantasy leagues
- **Draft Analysis**: Complete draft history and pick tracking
- **Roster Management**: Current roster tracking with acquisition history
- **Team Management**: Fantasy team information and owner details

### AWS Infrastructure
- **Serverless Architecture**: Lambda functions with API Gateway
- **Secure Database**: PostgreSQL RDS in private subnets
- **Cost Optimized**: ~$15-18/month operational cost
- **Scalable Design**: Auto-scaling Lambda with proper VPC configuration

## 🚀 Quick Start

### Prerequisites
- AWS CLI configured with appropriate permissions
- Terraform installed
- Python 3.11+
- ESPN Fantasy account with S2/SWID cookies for private leagues

### Infrastructure Deployment
```bash
# Deploy AWS infrastructure
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

### Data Loading

#### NFL Data
```bash
# Load NFL teams, players, games, and stats
python scripts/load_nfl_data.py --all

# Load specific data types
python scripts/load_nfl_data.py --teams --players
python scripts/load_nfl_data.py --games --season 2025
python scripts/load_nfl_data.py --stats --weeks 1-3
```

#### Fantasy League Data
```bash
# Load complete fantasy league data
python scripts/load_fantasy_data.py --league YOUR_LEAGUE_ID --all

# Load specific components
python scripts/load_fantasy_data.py --league YOUR_LEAGUE_ID --info --teams
python scripts/load_fantasy_data.py --league YOUR_LEAGUE_ID --draft --rosters
```

## 📊 API Endpoints

**Base URL**: `https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev`

### NFL Endpoints
- `GET /api/nfl/teams` - All NFL teams
- `GET /api/nfl/players` - NFL players with filtering
- `GET /api/nfl/games` - NFL games by season/week
- `GET /api/nfl/stats` - Player game statistics

### Fantasy Endpoints
- `GET /api/fantasy/leagues` - Fantasy leagues
- `GET /api/fantasy/teams` - Fantasy teams
- `GET /api/fantasy/draft` - Draft picks
- `GET /api/fantasy/rosters` - Roster entries

**Interactive Documentation**: `/docs` endpoint provides full API documentation

## 🗄️ Database Management

### Bastion Host Access
```bash
# Connect to bastion host
ssh -i ~/.ssh/fantasy-football-bastion ec2-user@BASTION_IP

# Connect to database
./connect-db.sh

# Run SQL files
PGPASSWORD="PASSWORD" psql -h DB_HOST -U postgres -d fantasy_football -f script.sql
```

### Database Schema
- **NFL Tables**: `nfl_teams`, `players`, `nfl_games`, `player_game_stats`
- **Fantasy Tables**: `league`, `fantasy_teams`, `draft_picks`, `roster_entries`
- **Constraints**: Proper unique constraints prevent duplicate data
- **Indexes**: Optimized for common query patterns

## 🔧 Configuration

### Environment Variables
Create `.env` file with:
```bash
# Database
DB_HOST=your-rds-endpoint
DB_PORT=5432
DB_NAME=fantasy_football
DB_USER=postgres
DB_PASSWORD=your-password

# ESPN Credentials
espn_ffl_user=your-email@example.com
espn_ffl_pw=your-password
my_espn2=your-s2-cookie
my_swid=your-swid-cookie
```

### ESPN Authentication
For private leagues, you need S2 and SWID cookies:
1. Log into ESPN Fantasy in your browser
2. Open Developer Tools → Application → Cookies
3. Find `espn_s2` and `SWID` values
4. Add to `.env` file as `my_espn2` and `my_swid`

## 📈 Current Data Status

### NFL Data (Complete)
- ✅ 32 NFL teams
- ✅ 2,579 active players
- ✅ 272 games (full 2025 season)
- ✅ 3,388+ player statistics

### Fantasy Data (Active)
- ✅ ESPN league integration
- ✅ Team and draft data
- ✅ Roster tracking
- 🔄 Transactions, matchups, lineups (in development)

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   ESPN APIs     │    │  Local Data  │    │   AWS Lambda    │
│                 │───▶│   Fetchers   │───▶│   REST API      │
│ (Teams, Stats,  │    │              │    │                 │
│  Fantasy Data)  │    └──────────────┘    └─────────────────┘
└─────────────────┘                                │
                                                   │
┌─────────────────┐    ┌──────────────┐           │
│  API Gateway    │◀───│   Internet   │◀──────────┘
│                 │    │   Gateway    │
└─────────────────┘    └──────────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌──────────────┐
│   PostgreSQL    │    │  Bastion     │
│   RDS (Private) │◀───│  Host        │
└─────────────────┘    └──────────────┘
```

## 🔒 Security

- **Private Database**: RDS in private subnets, no public access
- **VPC Security**: Proper security groups and network ACLs
- **Bastion Access**: Secure jump host for database administration
- **Encrypted Storage**: RDS encryption at rest
- **IAM Roles**: Least privilege access for Lambda functions

## 💰 Cost Optimization

- **No NAT Gateway**: Removed to save ~$33/month
- **Right-sized Resources**: t3.micro bastion, appropriate Lambda memory
- **Storage Optimization**: GP3 storage with auto-scaling
- **Current Cost**: ~$15-18/month

## 🚧 Roadmap

### Immediate (Next Session)
- [ ] Cognito authentication for API access
- [ ] Complete fantasy data fetchers (transactions, matchups, lineups)
- [ ] User management system

### Future Enhancements
- [ ] Frontend web application
- [ ] Real-time data updates
- [ ] Advanced analytics and reporting
- [ ] Mobile app support
- [ ] Multi-league management

## 📝 Development

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run API locally
python scripts/run_api_local.py

# Access local API
curl http://localhost:8000/api/nfl/teams
```

### Deployment
```bash
# Deploy API updates
scripts/deploy_lambda_api.sh

# Update infrastructure
cd infrastructure/terraform && terraform apply
```

## 🤝 Contributing

This is a personal project for learning AWS, fantasy football APIs, and full-stack development. Feel free to explore the code and architecture!

## 📄 License

Private project - All rights reserved.
