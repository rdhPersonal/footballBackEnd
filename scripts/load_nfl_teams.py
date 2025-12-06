#!/usr/bin/env python3
"""
Script to load NFL teams data.
"""
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.loaders.nfl_teams_loader import main

if __name__ == '__main__':
    main()
