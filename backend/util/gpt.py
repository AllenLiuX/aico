from datetime import datetime, timedelta
import time
import os, sys
import csv

from pathlib import Path

import pandas as pd
import re
import openai
from openai import OpenAI
import numpy as np
import sys
from enum import Enum, unique
import re
from keys import *

USE_GPT = True

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
    },
    # "gpt4o": {
    #     "name":"gpt-4o-2024-05-13", 
    #     "azure_endpoint": "https://search-va.byteintl.net/gpt/openapi/online/v2/crawl", 
    #     "api_key": "Qbj2AeJBxQoENtAthOI7SFZ6BTWf2yEs"
    # },
    "gpt4o": {
        "name":"gpt-4o-2024-08-06", 
        "api_key": api_key
    },
    "gpt4o_mini": {
        "name":"gpt-4o-mini",
        "api_key": api_key
    }
}

model_choice = "128k"
model_choice = "8k"
model_choice = 'gpt4o'
# model_choice = 'gpt4o_mini'

perplexity_api_key = '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'
perplexity_client = OpenAI(api_key=perplexity_api_key, base_url="https://api.perplexity.ai")


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

def personal_gpt(prompt):    
    # try:
    client = OpenAI(api_key=models[model_choice]['api_key'])

    completion = client.chat.completions.create(
        model=models[model_choice]['name'],
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.00,
        max_tokens=4000
    )

    return completion.choices[0].message.content
    # except Exception as e:


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
                # model="llama-3-sonar-small-32k-online",
                model="llama-3.1-sonar-small-128k-chat",
                # model="sonar-medium-chat",
                # model="sonar-medium-online",
                messages=chat_log,
    ).choices[0].message.content
    modify_chatlog(chat_log, "assistant", answer)

    return answer

def print_log(myStr):
    print("\n\n==========\n{myStr}\n==========".format(myStr=myStr))


@memoize
def gpt_single_reply(prompt):
    client = openai.AzureOpenAI(
            azure_endpoint=models[model_choice]['azure_endpoint'],
            api_version="2023-07-01-preview",
            api_key=models[model_choice]['api_key']
        ) 
    
    result = call_openai_chat_completions(client, prompt)
    return result


if __name__ == "__main__":

    # print('sending perplexity request test...')
    prompt = "what's the recent minor protection policy in United States for social media apps?"
    # reply = query_perplexity(prompt)
    # print(reply)
    print('sending gpt request test...')
    # reply = gpt_single_reply(prompt)
    reply = personal_gpt(prompt)
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
