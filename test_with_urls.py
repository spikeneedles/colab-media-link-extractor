import requests
import json
import uuid
import time

# Create session
session_id = 'kodi-' + str(uuid.uuid4())
announce = requests.post('http://localhost:3001/api/kodi-sync/announce',
    json={'session_id': session_id, 'kodi_source': 'test'})
print('Session:', session_id)

# First queue a job via receive
job_resp = requests.post('http://localhost:3001/api/kodi-sync/receive',
    json={
        'source_url': 'https://example.com/repository',
        'kodi_session_id': session_id,
        'kodi_source': 'test',
        'media_type': 'video'
    })
job_id = job_resp.json()['job_id']
print(f'Job queued: {job_id}')

# Wait for it to process
time.sleep(6)

# Now use the ingest endpoint to add URLs to this job
urls_to_ingest = [
    {
        'url': 'https://cdn.example.com/movies/action_movie.mp4',
        'contentType': 'video/mp4',
        'metadata': {'title': 'Action Movie', 'duration': 7200}
    },
    {
        'url': 'https://stream.site/live/stream.m3u8',
        'contentType': 'application/vnd.apple.mpegurl',
        'metadata': {'title': 'Live Stream', 'type': 'hls'}
    },
    {
        'url': 'https://media.server/audio/podcast.mp3',
        'contentType': 'audio/mpeg',
        'metadata': {'title': 'Podcast Episode'}
    },
    {
        'url': 'https://content.cdn/series/episode1.mp4',
        'contentType': 'video/mp4',
        'metadata': {'title': 'Series S01E01'}
    },
    {
        'url': 'https://live.tv/channels/news.m3u8',
        'contentType': 'application/vnd.apple.mpegurl',
        'metadata': {'title': 'News Channel'}
    }
]

print(f'\nIngesting {len(urls_to_ingest)} URLs...')
ingest_ids = []
for url_data in urls_to_ingest:
    ingest_payload = {
        'job_id': job_id,
        'source_url': url_data['url'],
        'kodi_session_id': session_id,
        'metadata': {
            'contentType': url_data['contentType'],
            'addon': {
                'id': 'test.addon',
                'sourceUrl': 'https://example.com/repository'
            },
            **url_data.get('metadata', {})
        }
    }
    
    ingest_resp = requests.post('http://localhost:3001/api/kodi-sync/ingest', json=ingest_payload)
    if ingest_resp.status_code in [200, 202]:
        result = ingest_resp.json()
        ingest_id = result.get('ingest_id', 'unknown')
        ingest_ids.append(ingest_id)
        print(f'  ✓ Ingested: {url_data["url"][:50]}... (ID: {ingest_id[:8]}...)')
    else:
        print(f'  ✗ Failed to ingest {url_data["url"]}: {ingest_resp.status_code}')

print(f'\n Waiting for ingestion to complete...')
time.sleep(3)

# Check the job status
latest = requests.get('http://localhost:3001/api/kodi-sync/latest-session')
data = latest.json()
print(f'\nSession has {data["total"]} jobs')
print(f'Completed: {data["summary"]["completed"]} jobs')

# Check if the first job now has URLs
if data['jobs']:
    first_job = data['jobs'][0]
    results_resp = requests.get(f'http://localhost:3001/api/kodi-sync/results/{first_job["job_id"]}')
    result_data = results_resp.json()
    
    print(f'\nJob results structure:')
    print(f'  - Status: {result_data.get("status")}')
    print(f'  - Result keys: {list(result_data.get("results", {}).keys())}')
    print(f'  - Has "urls" array: {"urls" in result_data.get("results", {})}')
    print(f'  - Has "links" array: {"links" in result_data.get("results", {})}')
    
    if 'urls' in result_data.get('results', {}):
        urls = result_data['results']['urls']
        print(f'  - URLs count: {len(urls)}')
        if urls:
            print(f'\nFirst URL: {json.dumps(urls[0], indent=4)}')

# Also check the ingest records
if ingest_ids:
    print(f'\n--- Checking first ingest record ---')
    ingest_check = requests.get(f'http://localhost:3001/api/kodi-sync/ingest/{ingest_ids[0]}')
    if ingest_check.status_code == 200:
        ingest_data = ingest_check.json()
        print(f'Ingest record: {json.dumps(ingest_data, indent=2)[:500]}...')

print(f'\n✓ Test session created: {session_id}')
print(f'  Total ingested: {len(ingest_ids)} URLs')
