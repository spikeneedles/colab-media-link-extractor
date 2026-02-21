import requests
import json
import uuid
import time

# Create session
session_id = 'kodi-' + str(uuid.uuid4())
requests.post('http://localhost:3001/api/kodi-sync/announce',
    json={'session_id': session_id, 'kodi_source': 'test'})
print('Session:', session_id)

# Queue multiple jobs with different media URLs
urls = [
    'https://example.com/movie1.mp4',
    'https://cdn.example.com/video.m3u8',
    'https://streaming.site/audio.mp3',
    'https://media.server/playlist.m3u8',
    'https://content.cdn/episode1.mp4'
]

for url in urls:
    resp = requests.post('http://localhost:3001/api/kodi-sync/receive',
        json={'source_url': url, 'kodi_session_id': session_id, 'kodi_source': 'test', 'media_type': 'video'})
    job_id = resp.json().get('job_id', 'unknown')
    print(f'Queued: {job_id[:8]}... for {url}')

# Wait for jobs to process
print('\nWaiting for jobs to complete...')
time.sleep(8)

# Check latest session
latest = requests.get('http://localhost:3001/api/kodi-sync/latest-session')
data = latest.json()
print(f'\nTotal jobs: {data["total"]}')
print('Summary:', json.dumps(data['summary']))
completed = [j for j in data['jobs'] if j['status'] == 'completed']
print(f'Completed: {len(completed)}/{data["total"]} jobs')

if completed:
    print('\n--- Checking first completed job results ---')
    first_job = completed[0]
    results = requests.get(f'http://localhost:3001/api/kodi-sync/results/{first_job["job_id"]}')
    result_data = results.json()
    print('Result keys:', list(result_data.get('results', {}).keys()))
    print('Has urls array:', 'urls' in result_data.get('results', {}))
    print('Has links array:', 'links' in result_data.get('results', {}))
