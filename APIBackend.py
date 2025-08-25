from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List, Dict, Any
import httpx
from bs4 import BeautifulSoup
import asyncio
import time
import os

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Allow all origins (for frontend integration)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def read_root():
    """Serve the main HTML file"""
    return FileResponse("static/index.html")

@app.get("/races")
def get_races() -> List[Dict[str, Any]]:
    """Scrape and return all races from TimeTeam results page."""
    url = "https://time-team.nl/en/info/results"
    try:
        resp = httpx.get(url, timeout=15)
        resp.raise_for_status()
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error fetching races: {e}")
    
    soup = BeautifulSoup(resp.text, "html.parser")
    races = []
    for a in soup.select("a.regatta-organiser"):
        name = a.select_one("h2").get_text(strip=True) if a.select_one("h2") else ""
        date = a.select_one("p").get_text(strip=True) if a.select_one("p") else ""
        href = a.get("href", "")
        if name:
            races.append({"name": name, "date": date, "url": href})
    return races

@app.get("/fields")
def get_fields(race_url: str = Query(..., description="URL of the race events page (e.g. .../results/events.php)")) -> List[Dict[str, Any]]:
    """Scrape and return all fields/events for a given race."""
    try:
        resp = httpx.get(race_url, timeout=15)
        resp.raise_for_status()
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error fetching fields: {e}")

    soup = BeautifulSoup(resp.text, "html.parser")
    fields = []
    for table in soup.select("table.timeteam"):
        for tr in table.select("tr"):
            tds = tr.find_all("td")
            if len(tds) >= 2 and tds[0].find("a") and tds[1].find("a"):
                code = tds[0].get_text(strip=True)
                name = tds[1].get_text(strip=True)
                url = tds[1].find("a").get("href", "")
                entries = tds[2].get_text(strip=True) if len(tds) > 2 else ""
                remarks = tds[3].get_text(strip=True) if len(tds) > 3 else ""
                race_url = race_url.rsplit('events',1)[0]
                url = race_url + url
                fields.append({"code": code, "name": name, "url": url, "entries": entries, "remarks": remarks})
    return fields

crew_positions = {'bow', '2', '3', '4', '5', '6', '7', 'stroke'}

async def fetch(client: httpx.AsyncClient, url: str) -> str:
    resp = await client.get(url)
    resp.raise_for_status()
    return resp.text

async def entry_to_names(url: str) -> List[Dict]:
    start = time.perf_counter()

    async with httpx.AsyncClient() as client:
        # Step 1: Get main page and parse entries
        resp_text = await fetch(client, url)
        soup = BeautifulSoup(resp_text, 'html.parser')

        entry_info = []
        for table in soup.select('table.timeteam'):
            for row in table.select('tr'):
                tds = row.find_all('td')
                if len(tds) < 3:
                    continue
                name_td = tds[2]
                if name_td.a:
                    boat_name = name_td.a.get_text(strip=True)
                    link = name_td.a.get('href')
                else:
                    boat_name = name_td.get_text(strip=True)
                    link = None
                if link and '/entry/' in link:
                    clean_link = link.lstrip('../')
                    entry_info.append((boat_name, clean_link))

        # Remove duplicates
        seen = set()
        unique_entries = []
        for name, link in entry_info:
            if link not in seen:
                seen.add(link)
                unique_entries.append((name, link))

        # Determine base part of the URL
        if 'entries' in url:
            base_part = url.rsplit('entries/', 1)[0]
        elif 'draw' in url:
            base_part = url.rsplit('draw/', 1)[0]
        else:
            base_part = url

        # Step 2: Build full URLs for crew pages
        full_entries = [(name, base_part + link) for name, link in unique_entries]

        # Step 3: Concurrently fetch crew pages
        async def scrape_crew(boat_name, entry_url):
            resp_text = await fetch(client, entry_url)
            soup = BeautifulSoup(resp_text, 'html.parser')

            crew_table = None
            for t in soup.find_all('table', class_='timeteam'):
                headers = [th.get_text(strip=True).lower() for th in t.find_all('th')]
                if 'pos.' in headers and 'naam' in headers:
                    crew_table = t
                    break

            names = []
            if crew_table:
                for tr in crew_table.find_all('tr')[1:]:
                    tds = tr.find_all('td')
                    if len(tds) >= 2:
                        position = tds[0].get_text(strip=True).lower().replace('\xa0', '')
                        if position in crew_positions:
                            name = tds[1].get_text(strip=True)
                            names.append(name)

            return {'name': boat_name, 'crew_members': names}

        tasks = [scrape_crew(name, url) for name, url in full_entries]
        results = await asyncio.gather(*tasks)


    return results

@app.get("/entries")
async def get_entries(race_url: str = Query(..., description="URL of the field/entries page (e.g. .../entries/...)")):
    """Asynchronously scrape and return all entries/crews for a given field."""
    try:
        results = await entry_to_names(race_url)
        return {"results": results}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"HTTP error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
