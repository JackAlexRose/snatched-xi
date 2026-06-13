#!/usr/bin/env python3
"""
FIFA data pipeline for Snatched XI — v2.
Extracts EPL players from the hugomathien/soccer SQLite database,
derives positions from attributes, and outputs the D1 seed directly.
No Wikipedia scraping needed.
"""
import sqlite3
import json
import re
import os

DB_PATH = "/home/jack/developer/workshop/snatched-xi/data/sources/database.sqlite"
OUT_DIR = "/home/jack/developer/workshop/snatched-xi/data/output"

# Attribute groups for our simplified 6-stat system
GROUPS = {
    'pace':        ('acceleration', 'sprint_speed'),
    'shooting':    ('finishing', 'shot_power', 'long_shots'),
    'passing':     ('short_passing', 'long_passing', 'crossing'),
    'dribbling':   ('dribbling', 'ball_control', 'agility'),
    'defending':   ('marking', 'standing_tackle', 'sliding_tackle', 'interceptions'),
    'physicality': ('strength', 'stamina', 'jumping', 'aggression'),
}

def avg(attrs, keys):
    vals = [attrs[k] for k in keys if attrs.get(k) is not None and attrs[k] > 0]
    return round(sum(vals) / len(vals)) if vals else None

def derive_position(attrs):
    """Derive coarse position (GK/DF/MF/FW) from FIFA attributes."""
    gk_score = sum(nv(attrs.get(k)) for k in 
                   ('gk_diving', 'gk_handling', 'gk_kicking', 'gk_positioning', 'gk_reflexes'))
    def_score = sum(nv(attrs.get(k)) for k in ('marking', 'standing_tackle', 'sliding_tackle'))
    atk_score = sum(nv(attrs.get(k)) for k in ('finishing', 'shot_power', 'positioning'))
    
    if gk_score > 200:  # Clear goalkeeper
        return 'GK'
    if def_score > atk_score + 20:
        return 'DF'
    if atk_score > def_score + 30:
        return 'FW'
    return 'MF'

def nv(val, default=0):
    """Get value or default, handling None."""
    return val if val is not None else default

def derive_sub_position(attrs, coarse_pos):
    """Derive more specific position."""
    cross = nv(attrs.get('crossing'))
    pace = avg(attrs, ('acceleration', 'sprint_speed')) or 0
    marking = nv(attrs.get('marking'))
    finishing = nv(attrs.get('finishing'))
    sp = nv(attrs.get('short_passing'))
    vision = nv(attrs.get('vision'))
    
    if coarse_pos == 'GK':
        return 'GK'
    if coarse_pos == 'DF':
        if cross > 60 and pace > 65:
            return 'FB'
        return 'CB'
    if coarse_pos == 'MF':
        if sp > 70 and vision > 70:
            return 'CAM'
        if marking > 60:
            return 'CDM'
        if cross > 65 and pace > 70:
            return 'WIDE'
        return 'CM'
    if coarse_pos == 'FW':
        if pace > 80 and cross > 60:
            return 'WING'
        return 'ST'
    return 'CM'

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    print("Extracting EPL players with attributes...")
    
    # More efficient: get all EPL matches first, then player appearances
    cur.execute("""
        SELECT match_api_id, home_team_api_id, away_team_api_id, season
        FROM Match WHERE league_id = 1729
        ORDER BY season
    """)
    matches = cur.fetchall()
    print(f"  {len(matches)} EPL matches")
    
    # Build season → teams mapping
    cur.execute("SELECT team_api_id, team_long_name FROM Team")
    team_map = {r[0]: r[1] for r in cur.fetchall()}
    
    # Build player API ID → name mapping
    cur.execute("SELECT player_api_id, player_name FROM Player")
    player_name_map = {r[0]: r[1] for r in cur.fetchall()}
    print(f"  {len(player_name_map)} players in DB")
    
    # Collect all player appearances per club-season
    # Key: (player_api_id, team_api_id, season) → set of match_ids
    from collections import defaultdict
    appearances = defaultdict(set)
    season_teams = defaultdict(set)  # (season, team_api_id)
    
    for match_id, home_id, away_id, season in matches:
        season_teams[(season, home_id)].add(match_id)
        season_teams[(season, away_id)].add(match_id)
    
    # For each match, get player appearances
    # Pre-load all player columns in one query per match
    player_cols = []
    for side in ['home', 'away']:
        for i in range(1, 12):
            player_cols.append(f"{side}_player_{i}")
    
    print("  Processing player appearances...")
    processed = 0
    for match_id, home_id, away_id, season in matches:
        cur.execute(f"""
            SELECT {', '.join(player_cols)}
            FROM Match WHERE match_api_id = ?
        """, (match_id,))
        row = cur.fetchone()
        if not row:
            continue
        
        for idx, player_api_id in enumerate(row):
            if player_api_id is None:
                continue
            # Determine which team this player is on
            if idx < 11:
                team_id = home_id
            else:
                team_id = away_id
            
            key = (player_api_id, team_id, season)
            appearances[key].add(match_id)
        
        processed += 1
        if processed % 500 == 0:
            print(f"    {processed}/{len(matches)} matches...")
    
    print(f"  {len(appearances)} player-club-season records")
    
    # Now extract attributes for each unique player
    unique_players = set(pid for pid, _, _ in appearances.keys())
    print(f"  {len(unique_players)} unique players")
    
    # Get attributes for all players at once
    cur.execute("""
        SELECT pa.player_api_id, pa.date,
               overall_rating, acceleration, sprint_speed,
               finishing, shot_power, long_shots,
               short_passing, long_passing, crossing,
               dribbling, ball_control, agility,
               marking, standing_tackle, sliding_tackle, interceptions,
               strength, stamina, jumping, aggression,
               heading_accuracy, vision, positioning, reactions, balance,
               gk_diving, gk_handling, gk_kicking, gk_positioning, gk_reflexes,
               preferred_foot
        FROM Player_Attributes pa
        ORDER BY pa.player_api_id, pa.date DESC
    """)
    
    # Group by player, take latest
    player_attrs = {}
    attr_cols = [
        'date', 'overall_rating', 'acceleration', 'sprint_speed',
        'finishing', 'shot_power', 'long_shots',
        'short_passing', 'long_passing', 'crossing',
        'dribbling', 'ball_control', 'agility',
        'marking', 'standing_tackle', 'sliding_tackle', 'interceptions',
        'strength', 'stamina', 'jumping', 'aggression',
        'heading_accuracy', 'vision', 'positioning', 'reactions', 'balance',
        'gk_diving', 'gk_handling', 'gk_kicking', 'gk_positioning', 'gk_reflexes',
        'preferred_foot'
    ]
    
    for row in cur.fetchall():
        pid = row[0]
        if pid not in player_attrs:  # Take first (latest) per player
            attrs = dict(zip(attr_cols, row[1:]))
            player_attrs[pid] = attrs
    
    print(f"  {len(player_attrs)} players with attributes")
    
    # Build final dataset
    output = []
    seen = set()
    
    for (player_api_id, team_id, season), match_set in appearances.items():
        player_name = player_name_map.get(player_api_id, f"Unknown-{player_api_id}")
        team_name = team_map.get(team_id, f"Unknown-{team_id}")
        attrs = player_attrs.get(player_api_id)
        
        if not attrs:
            continue
        
        # Derive position
        coarse_pos = derive_position(attrs)
        sub_pos = derive_sub_position(attrs, coarse_pos)
        
        # Compute game attributes
        game_attrs = {}
        for attr_name, keys in GROUPS.items():
            val = avg(attrs, keys)
            if val is not None:
                game_attrs[attr_name] = val
        
        # Build unique ID
        slug_name = re.sub(r'[^a-z0-9]', '-', player_name.lower())
        slug_season = season.replace('/', '-')
        player_id = f"{slug_name}-{slug_season}"
        
        # Deduplicate
        dedup_key = (player_name.lower(), team_name.lower(), season)
        if dedup_key in seen:
            continue
        seen.add(dedup_key)
        
        entry = {
            'id': player_id,
            'name': player_name,
            'club': team_name,
            'season': season,
            'position': coarse_pos,
            'sub_position': sub_pos,
            'matches_played': len(match_set),
            'overall': attrs['overall_rating'],
            'pace': game_attrs.get('pace'),
            'shooting': game_attrs.get('shooting'),
            'passing': game_attrs.get('passing'),
            'dribbling': game_attrs.get('dribbling'),
            'defending': game_attrs.get('defending'),
            'physicality': game_attrs.get('physicality'),
            'preferred_foot': attrs.get('preferred_foot'),
        }
        output.append(entry)
    
    conn.close()
    
    # Sort
    output.sort(key=lambda p: (p['season'], p['club'], p['name']))
    
    # Save JSON
    os.makedirs(OUT_DIR, exist_ok=True)
    json_path = os.path.join(OUT_DIR, 'seed.json')
    with open(json_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved {len(output)} players to {json_path}")
    
    # Stats
    from collections import Counter
    print("\n=== STATS ===")
    season_counts = Counter(p['season'] for p in output)
    for s in sorted(season_counts):
        print(f"  {s}: {season_counts[s]} players")
    
    pos_counts = Counter(p['position'] for p in output)
    print(f"\nPositions: {dict(pos_counts)}")
    
    subpos_counts = Counter(p['sub_position'] for p in output)
    print(f"Sub-positions: {dict(subpos_counts)}")
    
    # Club-seasons
    club_seasons = set((p['club'], p['season']) for p in output)
    print(f"\nClub-seasons: {len(club_seasons)}")
    
    # Sample
    print("\n=== SAMPLES ===")
    for p in output[:3]:
        print(f"  {p['name']} ({p['club']}, {p['season']}) "
              f"[{p['position']}/{p['sub_position']}] OVR={p['overall']} "
              f"PAC={p['pace']} SHO={p['shooting']} PAS={p['passing']} "
              f"DRI={p['dribbling']} DEF={p['defending']} PHY={p['physicality']}")

if __name__ == '__main__':
    main()
