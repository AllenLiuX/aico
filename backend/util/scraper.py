from firecrawl.firecrawl import FirecrawlApp

app = FirecrawlApp(api_key="fc-bf8738e43b3046f8a5987087a6b53455")

# Scrape a website:
# 'https://firecrawl.dev'
url = 'https://music.163.com/#/user/songs/rank?id=354879837'
scrape_status = app.scrape_url(
  url, 
  params={
    'formats': ['markdown', 'html'],
    'actions': [
        {"type": "wait", "milliseconds": 2000},
    ]
  },
)
print(scrape_status['markdown'])

# # Crawl a website:
# crawl_status = app.crawl_url(
#   'https://firecrawl.dev', 
#   params={
#     'limit': 100, 
#     'scrapeOptions': {'formats': ['markdown', 'html']}
#   }, 
#   poll_interval=30
# )
# print(crawl_status)