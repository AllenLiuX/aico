import httpx

try:
    response = httpx.get("https://httpbin.org/get")
    print(response.json())
except Exception as e:
    print(f"Error: {e}")