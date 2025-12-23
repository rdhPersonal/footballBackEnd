"""
Fantasy Football FastAPI Application.
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
import logging
import json

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
    docs_url="/public/docs",  # Move docs to public path
    redoc_url="/public/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware to handle Cognito authorization context
@app.middleware("http")
async def cognito_auth_middleware(request: Request, call_next):
    """
    Middleware to handle Cognito authorization context from API Gateway.
    
    When API Gateway uses Cognito authorizer, it passes user info in the request context.
    This middleware extracts that information and makes it available to route handlers.
    """
    # Check if this is a protected endpoint (starts with /api/)
    if request.url.path.startswith("/api/"):
        # For protected endpoints, check for Cognito context
        # API Gateway passes this in the event context when using Lambda proxy integration
        cognito_context = getattr(request.state, 'cognito_context', None)
        
        # Log the request for debugging
        logger.info(f"Protected endpoint accessed: {request.url.path}")
        logger.info(f"Headers: {dict(request.headers)}")
        
        # The Cognito context will be available in the Lambda event
        # We'll handle this in the Lambda handler wrapper
    
    response = await call_next(request)
    return response


# Include NFL routers (protected)
app.include_router(nfl_teams.router)
app.include_router(nfl_players.router)
app.include_router(nfl_games.router)
app.include_router(nfl_stats.router)

# Include Fantasy Football routers (protected)
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
    """Root endpoint - redirects to docs."""
    return {
        "message": "Fantasy Football API",
        "version": "1.0.0",
        "docs": "/public/docs",
        "public_endpoints": "/public/*",
        "protected_endpoints": "/api/* (requires Cognito authentication)"
    }


@app.get("/public/health")
def public_health_check():
    """Public health check endpoint."""
    return {"status": "healthy", "auth_required": False}


@app.get("/api/health")
def protected_health_check(request: Request):
    """Protected health check endpoint - requires authentication."""
    # Extract user info from Cognito context if available
    user_info = getattr(request.state, 'user_info', {})
    
    return {
        "status": "healthy", 
        "auth_required": True,
        "user": user_info.get('username', 'unknown'),
        "user_pool": user_info.get('user_pool_id', 'unknown')
    }


@app.get("/public/info")
def api_info():
    """Public API information endpoint."""
    return {
        "api": "Fantasy Football API",
        "version": "1.0.0",
        "authentication": {
            "type": "AWS Cognito User Pools",
            "protected_paths": ["/api/*"],
            "public_paths": ["/public/*", "/", "/docs", "/redoc"]
        },
        "endpoints": {
            "nfl": {
                "teams": "/api/nfl/teams",
                "players": "/api/nfl/players", 
                "games": "/api/nfl/games",
                "stats": "/api/nfl/stats"
            },
            "fantasy": {
                "leagues": "/api/fantasy/leagues",
                "teams": "/api/fantasy/teams",
                "draft": "/api/fantasy/draft",
                "rosters": "/api/fantasy/rosters",
                "transactions": "/api/fantasy/transactions",
                "matchups": "/api/fantasy/matchups",
                "lineups": "/api/fantasy/lineups",
                "scores": "/api/fantasy/scores"
            }
        }
    }


# Custom Lambda handler to process Cognito authorization context
def lambda_handler(event, context):
    """
    Custom Lambda handler that processes Cognito authorization context
    before passing to FastAPI via Mangum.
    """
    logger.info(f"Lambda event: {json.dumps(event, default=str)}")
    
    # Extract Cognito authorization context if present
    request_context = event.get('requestContext', {})
    authorizer = request_context.get('authorizer', {})
    
    if authorizer:
        logger.info(f"Cognito authorizer context: {json.dumps(authorizer, default=str)}")
        
        # Extract user information from Cognito claims
        claims = authorizer.get('claims', {})
        if claims:
            # Store user info in event for FastAPI to access
            event['cognito_user'] = {
                'username': claims.get('cognito:username', claims.get('sub')),
                'email': claims.get('email'),
                'user_pool_id': claims.get('iss', '').split('/')[-1] if claims.get('iss') else None,
                'token_use': claims.get('token_use'),
                'auth_time': claims.get('auth_time'),
                'exp': claims.get('exp'),
                'iat': claims.get('iat')
            }
            logger.info(f"Extracted user info: {event['cognito_user']}")
    
    # Use Mangum to handle the FastAPI app
    mangum_handler = Mangum(app)
    return mangum_handler(event, context)


# For backwards compatibility, keep the handler name
handler = lambda_handler
