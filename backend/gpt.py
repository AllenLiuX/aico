from datetime import datetime, timedelta
import time
import os, sys
import csv
# import bytedtqs
from pathlib import Path
# import euler
import pandas as pd
import re
import openai
from openai import OpenAI
# import subprocess
# import asyncio
# import httpx
import numpy as np
import sys
# import concurrent
from enum import Enum, unique
import re

USE_GPT = True

# """TQS Parameters"""
# # TQS_APP_ID="sKwa3b1yrMTaFriJrmO4EUxVVe1FwRLza0oQaST3nccJfgoO"
# # TQS_APP_KEY="AK6rBdnwKQ3QIFlQpL0WXgVavidppr1b4GhAL45hom4vYyeC"
# TQS_APP_ID = 'XWzffeiSC5mpFHQD9oILgaSng5QYwa0Bn1NjR7gA41UAuuqN'
# TQS_APP_KEY = 'd6gvLmhvcRv5IvmPcy74pXbnCol4gosMqNdWHoLTINs3u9fR'
# TQS_CLUSTER="va"
# TQS_PREFIX = """
#             set tqs.query.engine.type=Presto; 
# """
# # TQS_USERNAME="meng.meng"
# TQS_USERNAME="vincent.liu"
# TQS_CONF = {
#     'yarn.cluster.name': 'momet',
#     'mapreduce.job.queuename': 'root.momet_tiktok_data_us_nuf'
# }
# root.momet_tiktok_data_us_nuf
# root.macaw_tiktok_data_us_local_ssd
# TQS_CONF = {'yarn.cluster.name':'mouse','mapreduce.job.queuename':'root.mouse_tiktok_data_us'}
# csv.field_size_limit(2000 * 1024 * 1024) # Needed to increase fetch size
pd.set_option('display.max_columns', None)

models = {
    "8k": {
        "name": "gpt-4-0613", 
        "azure_endpoint": "https://search-va.byteintl.net/gpt/openapi/offline/v2/crawl", 
        "api_key": "1vteiIwAkTG2Lh7Az7ymhp0AqgcDCHM3"
    },
    "128k": {
        "name": "gpt-4-1106-preview", 
        "azure_endpoint": "https://search-va.byteintl.net/gpt/openapi/online/v2/crawl", 
        "api_key": "Qbj2AeJBxQoENtAthOI7SFZ6BTWf2yEs"
    }
}

model_choice = "128k"
model_choice = "8k"

perplexity_api_key = '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'
perplexity_client = OpenAI(api_key=perplexity_api_key, base_url="https://api.perplexity.ai")

@unique
class QueryType(Enum):
    EVENT: str = 'Event'
    POST: str = 'Post'
    NEWS: str = 'News'
    CRISIS: str = 'Crisis'
    GENERAL: str = 'General'    # non TikTok Question
    ALL: str = 'All'



def memoize(f):
    cache = {}
    def _call_with_cache(*args, **kwargs):
        key = "{} - {}".format(args, kwargs)
        if key not in cache:
            cache[key] = f(*args, **kwargs)
        return cache[key]
    return _call_with_cache

def is_number(string):
    try:
        # Try to convert the string to a float
        float(string)
        return True
    except ValueError:
        # If a ValueError occurs, the string cannot be converted to a number
        return False

@memoize
def call_openai_chat_completions(client, request_content):
   
    completion = client.chat.completions.create(
        # model="gpt-4-0613",
        model=models[model_choice]['name'],
        messages=[
            {
                "role": "system", 
                # "content": "You're a helpful, flexible, smart and professional product manager in a high tech company. You follow instructions extremely well and also help as much as you can. \
                #              You will be given a twitter post and answer users' questions."
                "content": "You're a helpful, flexible, smart and professional product manager in a high tech company. You follow instructions extremely well and also help as much as you can. \
                             You will be given background information and answer users' questions."
            },
            {
                "role": "user",
                "content": request_content
            }
        ],
        temperature=0.00,
        max_tokens=4000
    )

    response = completion.choices[0].message.content
    return response


def modify_chatlog(chat_log, role, content): 
    chat_log.append(
                  {
                    "role": role,
                    "content": content
                  }
    )
    
@memoize
def query_perplexity(question, perplexity_client=perplexity_client, experiment_date='', chat_log=[]):
    time.sleep(2)
    if not chat_log:
        chat_log = [
                     {
                      "role": "system",
                      "content": (
                         "You are an artificial intelligence assistant and you need to "
                         "engage in a helpful, detailed, polite conversation with a user."
                      ),
                     }
        ]
    if experiment_date:
        question = question + f" Your sources of information should be no later than the date of {experiment_date}."
    modify_chatlog(chat_log, "user", question)

   
    answer = perplexity_client.chat.completions.create(
                model="llama-3-sonar-small-32k-online",
                # model="sonar-medium-chat",
                # model="sonar-medium-online",
                messages=chat_log,
    ).choices[0].message.content
    modify_chatlog(chat_log, "assistant", answer)

    return answer

def print_log(myStr):
    print("\n\n==========\n{myStr}\n==========".format(myStr=myStr))


# async def main(prompts):
#     client = openai.AzureOpenAI(
#         azure_endpoint="https://search-va.byteintl.net/gpt/openapi/offline/v2/crawl",
#         api_version="2023-07-01-preview",
#         api_key="1vteiIwAkTG2Lh7Az7ymhp0AqgcDCHM3"
#     )    
#     results = [] 
#     with concurrent.futures.ThreadPoolExecutor() as executor:
#         tasks = [loop.run_in_executor(executor, call_openai_chat_completions, client, prompt) for prompt in prompts]
#         for response in await asyncio.gather(*tasks):
#             results.append(response.strip("\n"))
    
#     return results


@memoize
def gpt_single_reply(prompt):
    # client = openai.AzureOpenAI(
    #     azure_endpoint="https://search-va.byteintl.net/gpt/openapi/offline/v2/crawl",
    #     api_version="2023-07-01-preview",
    #     api_key="1vteiIwAkTG2Lh7Az7ymhp0AqgcDCHM3"
    # )    
    client = openai.AzureOpenAI(
            azure_endpoint=models[model_choice]['azure_endpoint'],
            api_version="2023-07-01-preview",
            api_key=models[model_choice]['api_key']
        ) 
    
    result = call_openai_chat_completions(client, prompt)
    return result


if __name__ == "__main__":

    prompt = "what's the recent minor protection policy in United States for social media apps?"
    reply = gpt_single_reply(prompt)
    print(reply)
    # if len(sys.argv) == 2:
    #     message = sys.argv[1]
    # else:
    #     message = "how's TikTok's brand perception on 20231128?"
    #     # message = "what's the recent minor protection policy in United States for social media apps?"

    # prompt_path = Path(__file__).parent / 'config' / 'prompts' / 'record-summary.md'
    # with open(prompt_path, 'r') as f:
    #     prompt_template = f.read()

    # log_path = Path(__file__).parent / 'logs'
    # entrance(message, prompt_template, log_path)




    