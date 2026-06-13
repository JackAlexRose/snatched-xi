#!/usr/bin/env python3
"""
Process the filtered EPL CSV from FIFA 23 dataset into Snatched XI seed data.
- One row per player per club per FIFA version (latest update per version)
- FIFA version mapped to season year
- Output D1-compatible SQL and JSON
"""
import csv
import json
import re
import os
from collections import defaultdict

INPUT_CSV = "/home/jack/developer/workshop/snatched-xi/data/output/epl_players.csv"
OUT_DIR = "/home/jack/developer/workshop/snatched-xi/data/output"

# FIFA version → season mapping (FIFA X represents previous season's data)
# FIFA 23 (released Sep 2022) = 2022-23 season, FIFA 15 (released Sep 2014) = 2014-15
FIFA_TO_SEASON = {
    '15': '2014-15',
    '16': '2015-16',
    '17': '2016-17',
    '18': '2017-18',
    '19': '2018-19',
    '20': '2019-20',
    '21': '2020-21',
    '22': '2021-22',
    '23': '2022-23',
}

def main():
    print("Processing EPL players...")
    
    # Group: (player_name, club_name, fifa_version) → list of rows (by update_date)
    groups = defaultdict(list)
    
    with open(INPUT_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get('long_name', '').strip()
            club = row.get('club_name', '').strip()
            version = row.get('fifa_version', '').strip()
            update_date = row.get('fifa_update_date', '').strip()
            
            if not name or not club or not version:
                continue
            
            key = (name, club, version)
            groups[key].append(row)
    
    print(f"  {len(groups)} unique player-club-version groups")
    
    # Take latest update per group and build output
    output = []
    seen_ids = set()
    
    for (name, club, version), rows in groups.items():
        # Sort by update_date descending, take first
        rows.sort(key=lambda r: r.get('fifa_update_date', ''), reverse=True)
        best = rows[0]
        
        season = FIFA_TO_SEASON.get(version)
        if not season:
            continue
        
        positions = best.get('player_positions', '').strip()
        overall = best.get('overall', '')
        pace = best.get('pace', '')
        shooting = best.get('shooting', '')
        passing = best.get('passing', '')
        dribbling = best.get('dribbling', '')
        defending = best.get('defending', '')
        physic = best.get('physic', '')
        preferred_foot = best.get('preferred_foot', '')  # Note: col is 'preferred_foot' not 'preferred_foot'
        
        # Build unique ID
        slug_name = re.sub(r'[^a-z0-9]', '-', name.lower().strip())
        player_id = f"{slug_name}-{season}"
        
        if player_id in seen_ids:
            continue
        seen_ids.add(player_id)
        
        entry = {
            'id': player_id,
            'name': name,
            'club': club,
            'season': season,
            'positions': positions,
            'overall': int(overall) if overall else None,
            'pace': int(pace) if pace else None,
            'shooting': int(shooting) if shooting else None,
            'passing': int(passing) if passing else None,
            'dribbling': int(dribbling) if dribbling else None,
            'defending': int(defending) if defending else None,
            'physicality': int(physic) if physic else None,
            'preferred_foot': preferred_foot,
        }
        output.append(entry)
    
    # Sort
    output.sort(key=lambda p: (p['season'], p['club'], p['name']))
    
    # Stats
    from collections import Counter
    print(f"\n  Total unique players: {len(output)}")
    
    season_counts = Counter(p['season'] for p in output)
    print("\n  Per season:")
    for s in sorted(season_counts):
        print(f"    {s}: {season_counts[s]} players")
    
    club_seasons = set((p['club'], p['season']) for p in output)
    print(f"\n  Club-seasons: {len(club_seasons)}")
    
    # Position breakdown
    all_positions = Counter()
    for p in output:
        for pos in p['positions'].split(','):
            pos = pos.strip()
            if pos:
                all_positions[pos] += 1
    print(f"\n  Position distribution: {dict(all_positions.most_common(15))}")
    
    # Save JSON
    os.makedirs(OUT_DIR, exist_ok=True)
    json_path = os.path.join(OUT_DIR, 'seed_fifa23.json')
    with open(json_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"\n  Saved JSON: {json_path}")
    
    # Generate SQL
    sql_lines = [
        "-- Snatched XI: D1 Seed Data (from FIFA 23 dataset)",
        "-- Seasons: 2014-15 through 2022-23",
        "",
        "CREATE TABLE IF NOT EXISTS players (",
        "  id TEXT PRIMARY KEY,",
        "  name TEXT NOT NULL,",
        "  club TEXT NOT NULL,",
        "  season TEXT NOT NULL,",
        "  positions TEXT NOT NULL,",
        "  overall INTEGER,",
        "  pace INTEGER,",
        "  shooting INTEGER,",
        "  passing INTEGER,",
        "  dribbling INTEGER,",
        "  defending INTEGER,",
        "  physicality INTEGER,",
        "  preferred_foot TEXT",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS club_seasons (",
        "  id TEXT PRIMARY KEY,",
        "  club TEXT NOT NULL,",
        "  season TEXT NOT NULL,",
        "  league TEXT NOT NULL DEFAULT 'Premier League'",
        ");",
        "",
    ]
    
    # Insert club_seasons
    for club, season in sorted(club_seasons):
        cs_id = f"{re.sub(r'[^a-z0-9]', '-', club.lower())}-{season}"
        sql_lines.append(
            f"INSERT OR IGNORE INTO club_seasons (id, club, season) "
            f"VALUES ('{cs_id}', '{club.replace(chr(39), chr(39)*2)}', '{season}');"
        )
    
    sql_lines.append("")
    
    # Insert players
    for p in output:
        cols = [
            f"'{p['id']}'",
            f"'{p['name'].replace(chr(39), chr(39)*2)}'",
            f"'{p['club'].replace(chr(39), chr(39)*2)}'",
            f"'{p['season']}'",
            f"'{p['positions']}'",
            str(p['overall']) if p['overall'] is not None else 'NULL',
            str(p['pace']) if p['pace'] is not None else 'NULL',
            str(p['shooting']) if p['shooting'] is not None else 'NULL',
            str(p['passing']) if p['passing'] is not None else 'NULL',
            str(p['dribbling']) if p['dribbling'] is not None else 'NULL',
            str(p['defending']) if p['defending'] is not None else 'NULL',
            str(p['physicality']) if p['physicality'] is not None else 'NULL',
            f"'{p.get('preferred_foot', '')}'" if p.get('preferred_foot') else 'NULL',
        ]
        sql_lines.append(f"INSERT OR IGNORE INTO players VALUES ({', '.join(cols)});")
    
    sql_path = os.path.join(OUT_DIR, 'seed_fifa23.sql')
    with open(sql_path, 'w') as f:
        f.write('\n'.join(sql_lines))
    print(f"  Saved SQL: {sql_path}")
    
    # Samples
    print("\n  === SAMPLES ===")
    for season in sorted(season_counts)[:3]:
        for p in output:
            if p['season'] == season:
                print(f"  {p['name']} ({p['club']}, {p['season']}) [{p['positions']}] "
                      f"OVR={p['overall']} PAC={p['pace']} SHO={p['shooting']} "
                      f"PAS={p['passing']} DRI={p['dribbling']} DEF={p['defending']} PHY={p['physicality']}")
                break

if __name__ == '__main__':
    main()
