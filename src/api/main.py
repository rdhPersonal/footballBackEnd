"""
Fantasy Football FastAPI Application.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
import logging

from src.api.routes import (
    nfl_teams, nfl_players, nfl_games, nfl_stats,
    fantasy_leagues, fantasy_teams, draft_picks, rosters,
    transactions, matchups, lineups, fantasy_scores
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Fantasy Football API",
    description="CRUD API for NFL and Fantasy Football data",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include NFL routers
app.include_router(nfl_teams.router)
app.include_router(nfl_players.router)
app.include_router(nfl_games.router)
app.include_router(nfl_stats.router)

# Include Fantasy Football routers
app.include_router(fantasy_leagues.router)
app.include_router(fantasy_teams.router)
app.include_router(draft_picks.router)
app.include_router(rosters.router)
app.include_router(transactions.router)
app.include_router(matchups.router)
app.include_router(lineups.router)
app.include_router(fantasy_scores.router)


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "message": "Fantasy Football API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# Lambda handler
handler = Mangum(app)
