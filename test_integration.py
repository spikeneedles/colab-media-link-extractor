import requests
import json
import uuid
import time

BASE_URL = 'http://localhost:3002'

# Create session
session_id = 'kodi-' + str(uuid.uuid4())
announce = requests.post(f'{BASE_URL}/api/kodi-sync/announce',
    json={'session_id': session_id, 'kodi_source': 'test'})
print('Session:', session_id)

# Queue a job
job_resp = requests.post(f'{BASE_URL}/api/kodi-sync/receive',
    json={
        'source_url': 'https://example.com/repository',
        'kodi_session_id': session_id,
        'kodi_source': 'test',
        'media_type': 'video'
    })
job_id = job_resp.json()['job_id']
print(f'Job queued: {job_id}')

# Wait for processing
time.sleep(6)

# Ingest URLs
urls_to_ingest = [
    {
        'url': ' https://cdn.example.com/movies/action_movie.mp4',
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
]

print(f'\nIngesting {len(urls_to_ingest)} URLs...')
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
    
    ingest_resp = requests.post(f'{BASE_URL}/api/kodi-sync/ingest', json=ingest_payload)
    if ingest_resp.status_code in [200, 202]:
        result = ingest_resp.json()
        ingest_id = result.get('ingest_id', 'unknown')
        print(f'  ✓ Ingested: {url_data["url"][:50]}...')
    else:
        print(f'  ✗ Failed: {ingest_resp.status_code}')

print(f'\nWaiting for ingestion...')
time.sleep(3)

# NOW TEST THE INTEGRATION: Fetch job results
print(f'\n=== TESTING INTEGRATION ===')
results_resp = requests.get(f'{BASE_URL}/api/kodi-sync/results/{job_id}')

if results_resp.status_code == 200:
    result_data = results_resp.json()
    
    print(f'\n✅ Job Results Response:')
    print(f'  - Status: {result_data.get("status")}')
    print(f'  - Has "urls" key: {"urls" in result_data}')
    
    if 'urls' in result_data:
        urls = result_data['urls']
        print(f'  - Total URLs: {result_data.get("total_ingested_urls", 0)}')
        print(f'  - URLs array length: {len(urls)}')
        
        if urls:
            print(f'\n✅ INTEGRATION SUCCESSFUL!')
            print(f'\nSample URL:')
            print(json.dumps(urls[0], indent=2))
        else:
            print(f'\n⚠️  URLs array exists but is empty')
    else:
        print(f'\n❌ No "urls" key in response')
        print(f'Available keys: {list(result_data.keys())}')
else:
    print(f'\n❌ Failed to fetch results: {results_resp.status_code}')

print(f'\nTest session: {session_id}')
print(f'Test job: {job_id}')
