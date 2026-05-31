import requests, json
url = 'http://127.0.0.1:8000/generate-caption'
data = {
    'prompt': 'Test topic',
    'platform': 'threads',
    'tone': 'casual'
}
response = requests.post(url, data=data)
print('Status:', response.status_code)
try:
    print('Response JSON:', response.json())
except Exception as e:
    print('Error parsing JSON:', e)
