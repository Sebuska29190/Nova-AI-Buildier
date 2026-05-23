import subprocess, json, time

# Wait a bit
time.sleep(5)

# Check jobs
result = subprocess.run(['curl', '-s', 'http://localhost:4123/api/video/jobs'], capture_output=True, text=True)
data = json.loads(result.stdout)
jobs = data.get('jobs', [])
for j in jobs[:5]:
    print(f'{j["id"]}: {j["status"]} - error: {j.get("error", "none")}')
    print(f'  progress: {j.get("progress", 0)}%')
