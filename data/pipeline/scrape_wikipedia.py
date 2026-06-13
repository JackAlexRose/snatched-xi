#!/usr/bin/env python3
"""
Wikipedia squad scraper for Snatched XI.
Scrapes squad data (player name, position, number) for all EPL club-seasons from 2008-09 to 2015-16.
"""
import urllib.request
import urllib.parse
import re
import json
import time
import os
import sys

DB_PATH = "/home/jack/developer/workshop/snatched-xi/data/sources/database.sqlite"
OUTPUT_PATH = "/home/jack/developer/workshop/snatched-xi/data/output/wiki_squads.json"

USER_AGENT = "SnatchedXI/1.0 (data-pipeline; contact@snatchedxi.dev)"

SEASONS = [
    "2008/2009", "2009/2010", "2010/2011", "2011/2012",
    "2012/2013", "2013/2014", "2014/2015", "2015/2016"
]

# Wikipedia season URL slug format
def season_to_slug(season_str):
    """Convert '2008/2009' to '2008–09'"""
    parts = season_str.split("/")
    start = parts[0]
    end = parts[1][2:]  # last two digits
    return f"{start}–{end}"

def team_name_to_wiki_slug(name):
    """Convert team name to Wikipedia URL path component."""
    # Known mappings for tricky club names
    KNOWN = {
        "Manchester United": "Manchester_United_F.C.",
        "Manchester City": "Manchester_City_F.C.",
        "Tottenham Hotspur": "Tottenham_Hotspur_F.C.",
        "West Ham United": "West_Ham_United_F.C.",
        "Newcastle United": "Newcastle_United_F.C.",
        "Stoke City": "Stoke_City_F.C.",
        "Hull City": "Hull_City_A.F.C.",
        "Swansea City": "Swansea_City_A.F.C.",
        "Cardiff City": "Cardiff_City_F.C.",
        "Norwich City": "Norwich_City_F.C.",
        "Leicester City": "Leicester_City_F.C.",
        "Burnley": "Burnley_F.C.",
        "Crystal Palace": "Crystal_Palace_F.C.",
        "Queens Park Rangers": "Queens_Park_Rangers_F.C.",
        "Wolverhampton Wanderers": "Wolverhampton_Wanderers_F.C.",
    }
    if name in KNOWN:
        return KNOWN[name]
    # Default: replace spaces with underscores and append F.C.
    return name.replace(" ", "_") + "_F.C."

def get_page(url, retries=3):
    """Fetch a Wikipedia page with retries."""
    for attempt in range(retries):
        try:
            # Properly encode the URL path (en dash etc.)
            parsed = urllib.parse.urlparse(url)
            encoded_path = urllib.parse.quote(parsed.path, safe='/')
            encoded_url = parsed._replace(path=encoded_path).geturl()
            
            req = urllib.request.Request(encoded_url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode('utf-8')
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)
    return None

def extract_squad_from_page(html, team_name, season_slug):
    """Extract squad data from a club season Wikipedia page."""
    if not html:
        return []
    
    players = []
    
    # Find squad section - try multiple heading IDs
    squad_ids = [
        'Squad_information',
        'First-team_squad', 
        'Current_squad',
        'Players',
        'First_team_squad',
    ]
    
    squad_start = None
    for sid in squad_ids:
        idx = html.find(f'id="{sid}"')
        if idx >= 0:
            squad_start = idx
            break
    
    # Fallback: search for "Squad" heading text
    if squad_start is None:
        m = re.search(r'<h[2-4][^>]*>.*?[Ss]quad.*?</h[2-4]>', html)
        if m:
            squad_start = m.start()
    
    if squad_start is None:
        print(f"    WARNING: No squad section found for {team_name} {season_slug}")
        return []
    
    # Get the next ~15000 chars after the heading
    chunk = html[squad_start:squad_start + 15000]
    
    # Find the squad table (wikitable with player data)
    table_match = re.search(r'<table class="wikitable[^"]*"[^>]*>(.*?)</table>', chunk, re.DOTALL)
    if not table_match:
        print(f"    WARNING: No squad table found for {team_name} {season_slug}")
        return []
    
    table_html = table_match.group(1)
    
    # Parse rows
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL)
    
    # Detect column layout from header row
    header_cells = []
    if rows:
        header_cells = re.findall(r'<th[^>]*>(.*?)</th>', rows[0], re.DOTALL)
        # Clean header text
        header_cells = [re.sub(r'<[^>]+>', '', c).strip().lower() for c in header_cells]
    
    # Find column indices
    name_col = None
    pos_col = None
    num_col = None
    
    for i, h in enumerate(header_cells):
        if h in ('name', 'player') and name_col is None:
            name_col = i
        elif h in ('position', 'pos', 'pos.') and pos_col is None:
            pos_col = i
        elif h in ('no', 'no.', 'number', 'n', '#') and num_col is None:
            num_col = i
    
    # Heuristic fallback: common Wikipedia squad table layout
    # Usually: Number (0), Position (1), Nationality (2), Name (3), ...
    if name_col is None:
        # Try to detect by looking at data rows
        for row in rows[1:6]:  # Check first few data rows
            cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
            if len(cells) >= 4:
                # Name is usually the longest text cell with a link
                for i, c in enumerate(cells):
                    if '<a href="/wiki/' in c and name_col is None:
                        name_col = i
                        break
    
    if pos_col is None and name_col is not None:
        pos_col = name_col - 1 if name_col > 0 else 1
    
    if num_col is None:
        num_col = 0
    
    # Parse data rows
    for row in rows[1:]:  # Skip header
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        if len(cells) < max(name_col or 3, pos_col or 2, num_col or 1) + 1:
            continue
        
        try:
            # Extract name
            name_cell = cells[name_col] if name_col is not None and name_col < len(cells) else ""
            name_match = re.search(r'<a[^>]*title="([^"]*)"[^>]*>', name_cell)
            if name_match:
                name = name_match.group(1)
            else:
                name = re.sub(r'<[^>]+>', '', name_cell).strip()
            
            if not name or len(name) < 2:
                continue
            
            # Extract position
            pos_cell = cells[pos_col] if pos_col is not None and pos_col < len(cells) else ""
            pos_match = re.search(r'title="([^"]*(?:Goalkeeper|Defender|Midfielder|Forward|Striker|Winger|Full-back|Centre-back)[^"]*)"', pos_cell)
            if pos_match:
                raw_pos = pos_match.group(1)
            else:
                raw_pos = re.sub(r'<[^>]+>', '', pos_cell).strip()
            
            # Map to coarse position
            pos_upper = raw_pos.upper()
            if 'GOALKEEPER' in pos_upper or raw_pos in ('GK', 'G'):
                position = 'GK'
            elif 'DEFENDER' in pos_upper or 'BACK' in pos_upper or raw_pos in ('DF', 'D', 'CB', 'LB', 'RB', 'RWB', 'LWB'):
                position = 'DF'
            elif 'MIDFIELDER' in pos_upper or 'MIDFIELD' in pos_upper or raw_pos in ('MF', 'M', 'CM', 'CDM', 'CAM', 'LM', 'RM'):
                position = 'MF'
            elif 'FORWARD' in pos_upper or 'STRIKER' in pos_upper or 'WINGER' in pos_upper or 'ATTACK' in pos_upper or raw_pos in ('FW', 'F', 'ST', 'CF', 'LW', 'RW'):
                position = 'FW'
            else:
                # Heuristic-based: check position text
                if any(t in pos_upper for t in ['GK', 'GOAL']):
                    position = 'GK'
                elif any(t in pos_upper for t in ['DEF', 'BACK']):
                    position = 'DF'
                elif any(t in pos_upper for t in ['MID', 'WING']):
                    position = 'MF'
                elif any(t in pos_upper for t in ['FOR', 'STR', 'ATT', 'CF', 'ST']):
                    position = 'FW'
                else:
                    position = 'MF'  # Default
            
            # Extract number
            num_cell = cells[num_col] if num_col is not None and num_col < len(cells) else ""
            num_text = re.sub(r'<[^>]+>', '', num_cell).strip()
            try:
                number = int(num_text)
            except ValueError:
                number = None
            
            players.append({
                'name': name,
                'position': position,
                'number': number,
                'club': team_name,
                'season': season_slug,
            })
        except Exception as e:
            continue
    
    return players

def get_teams_from_fifa_db(season_str):
    """Get EPL teams for a season from the FIFA database."""
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT t.team_long_name 
        FROM Match m 
        JOIN Team t ON t.team_api_id IN (m.home_team_api_id, m.away_team_api_id)
        WHERE m.league_id = 1729 AND m.season = ?
        ORDER BY t.team_long_name
    """, (season_str,))
    teams = [r[0] for r in cur.fetchall()]
    conn.close()
    return teams

def main():
    all_players = []
    
    for season in SEASONS:
        season_slug = season_to_slug(season)
        print(f"\n{'='*60}")
        print(f"Season: {season_slug}")
        print(f"{'='*60}")
        
        teams = get_teams_from_fifa_db(season)
        print(f"Teams: {len(teams)}")
        
        for team in teams:
            wiki_slug = team_name_to_wiki_slug(team)
            url = f"https://en.wikipedia.org/wiki/{season_slug}_{wiki_slug}_season"
            print(f"  {team}: {url}")
            
            html = get_page(url)
            players = extract_squad_from_page(html, team, season_slug)
            
            if players:
                all_players.extend(players)
                print(f"    → {len(players)} players extracted")
            else:
                # Try alternative URL format (some clubs use different naming)
                alt_url = f"https://en.wikipedia.org/wiki/{season_slug}_{team.replace(' ', '_')}_season"
                print(f"    Retry: {alt_url}")
                html = get_page(alt_url)
                players = extract_squad_from_page(html, team, season_slug)
                if players:
                    all_players.extend(players)
                    print(f"    → {len(players)} players extracted (alt URL)")
                else:
                    print(f"    → SKIPPED (no squad data)")
            
            time.sleep(0.5)  # Be polite to Wikipedia
        
        print(f"  Season total: {len([p for p in all_players if p['season'] == season_slug])}")
    
    # Save results
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(all_players, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"TOTAL: {len(all_players)} players across {len(SEASONS)} seasons")
    print(f"Saved to: {OUTPUT_PATH}")
    
    # Show per-season breakdown
    from collections import Counter
    season_counts = Counter(p['season'] for p in all_players)
    for season in sorted(season_counts):
        print(f"  {season}: {season_counts[season]} players")
    
    # Show per-position breakdown
    pos_counts = Counter(p['position'] for p in all_players)
    print(f"\nPositions: {dict(pos_counts)}")

if __name__ == '__main__':
    main()
