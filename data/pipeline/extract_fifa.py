#!/usr/bin/env python3
"""
FIFA attribute extractor for Snatched XI.
Extracts player attributes from the hugomathien/soccer SQLite database
and outputs a structured JSON file keyed by player name for merging.
"""
import sqlite3
import json
import os
from collections import defaultdict

DB_PATH = "/home/jack/developer/workshop/snatched-xi/data/sources/database.sqlite"
OUTPUT_PATH = "/home/jack/developer/workshop/snatched-xi/data/output/fifa_attributes.json"

# Map FIFA attributes to our game's simplified 6-attribute schema
ATTRIBUTE_MAP = {
    'pace': ('acceleration', 'sprint_speed'),
    'shooting': ('finishing', 'shot_power', 'long_shots'),
    'passing': ('short_passing', 'long_passing', 'crossing'),
    'dribbling': ('dribbling', 'ball_control', 'agility'),
    'defending': ('marking', 'standing_tackle', 'sliding_tackle', 'interceptions'),
    'physicality': ('strength', 'stamina', 'jumping', 'aggression'),
}

def compute_aggregate(attrs, keys):
    """Compute average of multiple attribute keys."""
    values = [attrs[k] for k in keys if attrs.get(k) is not None]
    if not values:
        return None
    return round(sum(values) / len(values))

def get_latest_attributes(cur, player_api_id):
    """Get the most recent attribute snapshot for a player."""
    cur.execute("""
        SELECT overall_rating, potential, preferred_foot,
               acceleration, sprint_speed,
               finishing, shot_power, long_shots,
               short_passing, long_passing, crossing,
               dribbling, ball_control, agility,
               marking, standing_tackle, sliding_tackle, interceptions,
               strength, stamina, jumping, aggression,
               heading_accuracy, vision, penalties, free_kick_accuracy,
               positioning, reactions, balance, curve, volleys,
               gk_diving, gk_handling, gk_kicking, gk_positioning, gk_reflexes,
               attacking_work_rate, defensive_work_rate,
               date
        FROM Player_Attributes
        WHERE player_api_id = ?
        ORDER BY date DESC
        LIMIT 1
    """, (player_api_id,))
    row = cur.fetchone()
    if not row:
        return None
    
    cols = [
        'overall_rating', 'potential', 'preferred_foot',
        'acceleration', 'sprint_speed',
        'finishing', 'shot_power', 'long_shots',
        'short_passing', 'long_passing', 'crossing',
        'dribbling', 'ball_control', 'agility',
        'marking', 'standing_tackle', 'sliding_tackle', 'interceptions',
        'strength', 'stamina', 'jumping', 'aggression',
        'heading_accuracy', 'vision', 'penalties', 'free_kick_accuracy',
        'positioning', 'reactions', 'balance', 'curve', 'volleys',
        'gk_diving', 'gk_handling', 'gk_kicking', 'gk_positioning', 'gk_reflexes',
        'attacking_work_rate', 'defensive_work_rate',
        'date'
    ]
    attrs = dict(zip(cols, row))
    
    # Compute our 6 game attributes
    game_attrs = {}
    for game_attr, fifa_keys in ATTRIBUTE_MAP.items():
        val = compute_aggregate(attrs, fifa_keys)
        if val is not None:
            game_attrs[game_attr] = val
    
    game_attrs['overall'] = attrs['overall_rating']
    game_attrs['preferred_foot'] = attrs['preferred_foot']
    
    return game_attrs

def get_epl_players_with_club_season(cur):
    """Get all EPL players mapped to their club-seasons."""
    cur.execute("""
        SELECT DISTINCT 
            p.player_api_id,
            p.player_name,
            t.team_long_name,
            m.season
        FROM Match m
        JOIN Team t ON (
            t.team_api_id = m.home_team_api_id 
            OR t.team_api_id = m.away_team_api_id
        )
        JOIN (
            SELECT match_api_id, home_player_1 as player_api_id FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, home_player_2 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, home_player_3 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, home_player_4 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, home_player_5 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, home_player_6 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, home_player_7 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, home_player_8 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, home_player_9 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, home_player_10 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, home_player_11 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, away_player_1 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, away_player_2 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, away_player_3 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, away_player_4 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, away_player_5 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, away_player_6 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, away_player_7 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, away_player_8 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, away_player_9 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, away_player_10 FROM Match WHERE league_id = 1729
            UNION SELECT match_api_id, away_player_11 FROM Match WHERE league_id = 1729
        ) appearances ON m.match_api_id = appearances.match_api_id
        JOIN Player p ON p.player_api_id = appearances.player_api_id
        WHERE m.league_id = 1729
        ORDER BY m.season, t.team_long_name, p.player_name
    """)
    return cur.fetchall()

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    print("Loading EPL players from database...")
    players = get_epl_players_with_club_season(cur)
    print(f"Found {len(players)} player-club-season records")
    
    # Build output: array of {name, club, season, attributes}
    # Also build a lookup keyed by (name_lower, club, season) for merging
    output = []
    seen = set()
    player_count = 0
    
    for player_api_id, player_name, team_name, season in players:
        key = (player_name.lower(), team_name.lower(), season)
        if key in seen:
            continue
        seen.add(key)
        
        attrs = get_latest_attributes(cur, player_api_id)
        if not attrs:
            continue
        
        entry = {
            'name': player_name,
            'club': team_name,
            'season': season,
            'overall': attrs['overall'],
            'pace': attrs.get('pace'),
            'shooting': attrs.get('shooting'),
            'passing': attrs.get('passing'),
            'dribbling': attrs.get('dribbling'),
            'defending': attrs.get('defending'),
            'physicality': attrs.get('physicality'),
            'preferred_foot': attrs.get('preferred_foot'),
        }
        output.append(entry)
        player_count += 1
    
    conn.close()
    
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"Extracted {player_count} players with attributes")
    print(f"Saved to: {OUTPUT_PATH}")
    
    # Stats
    from collections import Counter
    season_counts = Counter(p['season'] for p in output)
    print("\nPer season:")
    for s in sorted(season_counts):
        print(f"  {s}: {season_counts[s]} players")
    
    # Sample
    print("\nSample entries:")
    for p in output[:5]:
        print(f"  {p['name']} ({p['club']}, {p['season']}): ovr={p['overall']}, "
              f"pac={p['pace']}, sho={p['shooting']}, pas={p['passing']}, "
              f"dri={p['dribbling']}, def={p['defending']}, phy={p['physicality']}")

if __name__ == '__main__':
    main()
