from firecrawl.firecrawl import FirecrawlApp

# import util.gpt as gpt
import gpt

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
res = scrape_status['markdown']
# print(res)
print("-----------------------------------")

prompt = f"""
Given the following HTML content, extract the songs and artists from the page. 
HTML content:
{res}

Output the result in JSON format. For example:
[
    {
        "song": "葡萄成熟时",
        "artists": ["陈奕迅"]
    },
    {
        "song": "兄妹",
        "artists": ["陈奕迅"]
    },
    {
        "song": "岁月如歌",
        "artists": ["陈奕迅"]
    },
    ...
]

"""

llm_result = gpt.personal_gpt(prompt, model_choice='gpt4o_mini')
print(llm_result)

