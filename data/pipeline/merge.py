#!/usr/bin/env python3
"""
Merge pipeline: cross-reference Wikipedia squad lists with FIFA attributes.
Produces the final D1-compatible seed JSON for Snatched XI.
"""
import json
import re
import os
from difflib import SequenceMatcher

WIKI_PATH = "/home/jack/developer/workshop/snatched-xi/data/output/wiki_squads.json"
FIFA_PATH = "/home/jack/developer/workshop/snatched-xi/data/output/fifa_attributes.json"
OUTPUT_PATH = "/home/jack/developer/workshop/snatched-xi/data/output/seed.json"
SQL_PATH = "/home/jack/developer/workshop/snatched-xi/data/output/seed.sql"

# Season format normalization
# Wikipedia: "2008–09", FIFA: "2008/2009"
def normalize_season(s):
    if '/' in s:
        parts = s.split('/')
        return f"{parts[0]}–{parts[1][2:]}"
    return s

def normalize_club(name):
    """Normalize club names for matching."""
    name = name.lower().strip()
    # Handle common variations
    replacements = {
        'fc': '',
        'f.c.': '',
        'afc': '',
        'afc.': '',
        '&': 'and',
    }
    for old, new in replacements.items():
        name = name.replace(old, new)
    # Remove extra whitespace
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def normalize_player(name):
    """Normalize player names for fuzzy matching."""
    name = name.lower().strip()
    # Remove diacritics roughly
    name = name.replace('á', 'a').replace('é', 'e').replace('í', 'i')
    name = name.replace('ó', 'o').replace('ú', 'u').replace('ñ', 'n')
    name = name.replace('ü', 'u').replace('ö', 'o').replace('ä', 'a')
    name = name.replace('č', 'c').replace('š', 's').replace('ž', 'z')
    name = name.replace('ć', 'c').replace('đ', 'd')
    return name

def fuzzy_match(name1, name2, threshold=0.85):
    """Fuzzy match two player names."""
    n1 = normalize_player(name1)
    n2 = normalize_player(name2)
    
    # Exact match after normalization
    if n1 == n2:
        return True
    
    # Handle reversed names (e.g., "Ronaldo Cristiano" vs "Cristiano Ronaldo")
    parts1 = n1.split()
    parts2 = n2.split()
    if sorted(parts1) == sorted(parts2):
        return True
    
    # Handle single name differences (e.g., "Cristiano Ronaldo" vs "C. Ronaldo")
    if len(parts1) == len(parts2) and len(parts1) == 2:
        # Check if first names match with initial
        if (parts1[0][0] == parts2[0][0] and parts1[1] == parts2[1]) or \
           (parts1[0] == parts2[0] and parts1[1][0] == parts2[1][0]):
            return True
    
    # Sequence matcher
    ratio = SequenceMatcher(None, n1, n2).ratio()
    return ratio >= threshold

def build_fifa_lookup(fifa_data):
    """Build a lookup dict for FIFA attributes: (norm_name, norm_club, norm_season) -> attrs"""
    lookup = {}
    for p in fifa_data:
        key = (
            normalize_player(p['name']),
            normalize_club(p['club']),
            normalize_season(p['season'])
        )
        lookup[key] = {
            'overall': p['overall'],
            'pace': p['pace'],
            'shooting': p['shooting'],
            'passing': p['passing'],
            'dribbling': p['dribbling'],
            'defending': p['defending'],
            'physicality': p['physicality'],
            'preferred_foot': p['preferred_foot'],
        }
    return lookup

def merge(wiki_data, fifa_lookup):
    """Merge Wikipedia squads with FIFA attributes."""
    merged = []
    matched = 0
    unmatched = 0
    
    # Track FIFA players we've used (to report unused ones)
    used_fifa = set()
    
    for wp in wiki_data:
        wiki_name = wp['name']
        wiki_club = wp['club']
        wiki_season = wp['season']
        wiki_position = wp['position']
        
        norm_name = normalize_player(wiki_name)
        norm_club = normalize_club(wiki_club)
        norm_season = normalize_season(wiki_season)
        
        # Try exact key match first
        exact_key = (norm_name, norm_club, norm_season)
        fifa_attrs = fifa_lookup.get(exact_key)
        
        if fifa_attrs:
            matched += 1
            used_fifa.add(exact_key)
        else:
            # Try fuzzy matching within same club-season
            candidates = [
                (k, v) for k, v in fifa_lookup.items()
                if k[1] == norm_club and k[2] == norm_season and k not in used_fifa
            ]
            
            best_match = None
            best_ratio = 0
            for ckey, cval in candidates:
                ratio = SequenceMatcher(None, norm_name, ckey[0]).ratio()
                if ratio > best_ratio and ratio >= 0.80:
                    best_ratio = ratio
                    best_match = (ckey, cval)
            
            if best_match:
                fifa_attrs = best_match[1]
                matched += 1
                used_fifa.add(best_match[0])
            else:
                unmatched += 1
        
        entry = {
            'id': f"{re.sub(r'[^a-z0-9]', '-', wp['name'].lower())}-{wiki_season.replace('–', '-')}",
            'name': wiki_name,
            'club': wiki_club,
            'season': wiki_season,
            'position': wiki_position,
            'number': wp.get('number'),
        }
        
        if fifa_attrs:
            entry.update({
                'overall': fifa_attrs['overall'],
                'pace': fifa_attrs['pace'],
                'shooting': fifa_attrs['shooting'],
                'passing': fifa_attrs['passing'],
                'dribbling': fifa_attrs['dribbling'],
                'defending': fifa_attrs['defending'],
                'physicality': fifa_attrs['physicality'],
                'preferred_foot': fifa_attrs.get('preferred_foot'),
            })
        
        merged.append(entry)
    
    return merged, matched, unmatched

def generate_sql(merged_data):
    """Generate D1-compatible SQL seed file."""
    lines = []
    lines.append("-- Snatched XI: D1 Seed Data")
    lines.append("-- Generated from Wikipedia + FIFA dataset merge")
    lines.append("")
    
    # Players table
    lines.append("CREATE TABLE IF NOT EXISTS players (")
    lines.append("  id TEXT PRIMARY KEY,")
    lines.append("  name TEXT NOT NULL,")
    lines.append("  club TEXT NOT NULL,")
    lines.append("  season TEXT NOT NULL,")
    lines.append("  position TEXT NOT NULL,")
    lines.append("  number INTEGER,")
    lines.append("  overall INTEGER,")
    lines.append("  pace INTEGER,")
    lines.append("  shooting INTEGER,")
    lines.append("  passing INTEGER,")
    lines.append("  dribbling INTEGER,")
    lines.append("  defending INTEGER,")
    lines.append("  physicality INTEGER,")
    lines.append("  preferred_foot TEXT")
    lines.append(");")
    lines.append("")
    
    # Club seasons table
    lines.append("CREATE TABLE IF NOT EXISTS club_seasons (")
    lines.append("  id TEXT PRIMARY KEY,")
    lines.append("  club TEXT NOT NULL,")
    lines.append("  season TEXT NOT NULL,")
    lines.append("  league TEXT NOT NULL DEFAULT 'Premier League'")
    lines.append(");")
    lines.append("")
    
    # Insert club seasons
    club_seasons = set()
    for p in merged_data:
        club_seasons.add((p['club'], p['season']))
    
    for club, season in sorted(club_seasons):
        cs_id = f"{re.sub(r'[^a-z0-9]', '-', club.lower())}-{season.replace('–', '-')}"
        lines.append(f"INSERT OR IGNORE INTO club_seasons (id, club, season) "
                     f"VALUES ('{cs_id}', '{club.replace(chr(39), chr(39)+chr(39))}', '{season}');")
    
    lines.append("")
    
    # Insert players
    for p in merged_data:
        vals = [
            f"'{p['id']}'",
            f"'{p['name'].replace(chr(39), chr(39)+chr(39))}'",
            f"'{p['club'].replace(chr(39), chr(39)+chr(39))}'",
            f"'{p['season']}'",
            f"'{p['position']}'",
            f"{p['number']}" if p.get('number') else "NULL",
            f"{p.get('overall')}" if p.get('overall') is not None else "NULL",
            f"{p.get('pace')}" if p.get('pace') is not None else "NULL",
            f"{p.get('shooting')}" if p.get('shooting') is not None else "NULL",
            f"{p.get('passing')}" if p.get('passing') is not None else "NULL",
            f"{p.get('dribbling')}" if p.get('dribbling') is not None else "NULL",
            f"{p.get('defending')}" if p.get('defending') is not None else "NULL",
            f"{p.get('physicality')}" if p.get('physicality') is not None else "NULL",
            f"'{p.get('preferred_foot', '')}'" if p.get('preferred_foot') else "NULL",
        ]
        lines.append(f"INSERT OR IGNORE INTO players VALUES ({', '.join(vals)});")
    
    return '\n'.join(lines)

def main():
    # Load data
    print("Loading Wikipedia squad data...")
    with open(WIKI_PATH) as f:
        wiki_data = json.load(f)
    print(f"  {len(wiki_data)} players from Wikipedia")
    
    print("Loading FIFA attribute data...")
    with open(FIFA_PATH) as f:
        fifa_data = json.load(f)
    print(f"  {len(fifa_data)} players with FIFA attributes")
    
    # Build lookup
    fifa_lookup = build_fifa_lookup(fifa_data)
    print(f"  {len(fifa_lookup)} unique lookup keys")
    
    # Merge
    print("\nMerging...")
    merged, matched, unmatched = merge(wiki_data, fifa_lookup)
    
    # Stats
    total = len(merged)
    print(f"\nResults:")
    print(f"  Total players: {total}")
    print(f"  With FIFA attributes: {matched} ({matched/total*100:.1f}%)")
    print(f"  Without FIFA attributes: {unmatched} ({unmatched/total*100:.1f}%)")
    
    # Position breakdown
    from collections import Counter
    pos_counts = Counter(p['position'] for p in merged)
    print(f"\nPositions: {dict(pos_counts)}")
    
    # Season breakdown
    season_counts = Counter(p['season'] for p in merged)
    print(f"\nPer season:")
    for s in sorted(season_counts):
        with_attrs = sum(1 for p in merged if p['season'] == s and p.get('overall'))
        print(f"  {s}: {season_counts[s]} players ({with_attrs} with attributes)")
    
    # Samples
    print("\nSample merged entries:")
    for p in merged[:5]:
        print(f"  {p['name']} ({p['club']}, {p['season']}) [{p['position']}] "
              f"OVR={p.get('overall', '?')}")
    
    # Save JSON
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(merged, f, indent=2)
    print(f"\nSaved JSON to: {OUTPUT_PATH}")
    
    # Generate and save SQL
    sql = generate_sql(merged)
    with open(SQL_PATH, 'w') as f:
        f.write(sql)
    print(f"Saved SQL to: {SQL_PATH}")
    
    # Club-season count
    club_seasons = set((p['club'], p['season']) for p in merged)
    print(f"\nClub-seasons: {len(club_seasons)}")

if __name__ == '__main__':
    main()
