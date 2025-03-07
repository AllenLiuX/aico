import base64
import json
import requests
from Crypto.Cipher import AES
import os
import random
import string
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

class NeteaseEncryptor:
    """
    网易云音乐加密工具:
    1) 前端 JS 中写死的一些参数(比如 NONCE)
    2) 对请求体进行两次AES加密, 然后再用RSA加密随机生成的 secret_key.
    """
    MODULUS = (
        "00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7"
        "b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280"
        "104e0312ecbda92557c93870114af6c9d05c4f7f0c3684fe18a4264d6c891"
        "8ded4f1f4cfae38d46f2e765a8e3fbfa03"
    )
    PUB_KEY = "010001"
    NONCE = "0CoJUm6Qyw8W8jud"

    @staticmethod
    def create_secret_key(size=16):
        chars = string.ascii_letters + string.digits
        return ''.join(random.choice(chars) for _ in range(size))

    @staticmethod
    def aes_encrypt(text, key):
        iv = b"0102030405060708"
        block_size = 16
        if isinstance(text, str):
            text = text.encode("utf-8")
        pad = block_size - len(text) % block_size
        text = text + bytes([pad]) * pad
        cipher = AES.new(key.encode("utf-8"), AES.MODE_CBC, iv)
        encrypted_bytes = cipher.encrypt(text)
        return base64.b64encode(encrypted_bytes).decode("utf-8")

    @staticmethod
    def rsa_encrypt(text, pub_key, modulus):
        text = text[::-1]
        rs = pow(int(text.encode('utf-8').hex(), 16), int(pub_key, 16), int(modulus, 16))
        return format(rs, 'x').zfill(131)


def scrape_user_songs_rank(user_id: int):
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    # service = Service(ChromeDriverManager().install())
    service = Service("/usr/local/bin/chromedriver")  # 指定手动安装的 chromedriver
    driver = webdriver.Chrome(service=service, options=options)
    
    try:
        target_url = f"https://music.163.com/#/user/songs/rank?id={user_id}"
        driver.get(target_url)
        
        # WebDriverWait(driver, 20).until(
        #     EC.frame_to_be_available_and_switch_to_it((By.NAME, "contentFrame"))
        # )
        try:
            driver.switch_to.frame(driver.find_element(By.NAME, "contentFrame"))
            print("✅ Switched to contentFrame successfully!")
        except:
            print("❌ contentFrame not found. Listing all iframes...")
            for iframe in driver.find_elements(By.TAG_NAME, "iframe"):
                print(f"Found iframe: {iframe.get_attribute('name')} {iframe.get_attribute('id')}")

        
        # WebDriverWait(driver, 10).until(
        #     EC.presence_of_all_elements_located((By.XPATH, "/html/body/div[3]/div/div[2]/div/div[1]/ul/li"))
        # )
        WebDriverWait(driver, 20).until(
            EC.visibility_of_any_elements_located((By.XPATH, "/html/body/div[3]/div/div[2]/div/div[1]/ul/li"))
        )
        
        song_items = driver.find_elements(By.XPATH, "/html/body/div[3]/div/div[2]/div/div[1]/ul/li")
        result = []
        for index, item in enumerate(song_items, start=1, stop=15):
            try:
                song_name = item.find_element(By.XPATH, f"/html/body/div[3]/div/div[2]/div/div[1]/ul/li[{index}]/div[2]/div[1]/div/span/a/b").text
            except:
                song_name = ""
            
            try:
                artist = item.find_element(By.XPATH, f"/html/body/div[3]/div/div[2]/div/div[1]/ul/li[{index}]/div[2]/div[1]/div/span/span/span/a").text
            except:
                artist = ""
            
            try:
                play_count = item.find_element(By.XPATH, f"/html/body/div[3]/div/div[2]/div/div[1]/ul/li[{index}]/div[3]/span[2]").text
            except:
                play_count = ""
            
            result.append({
                "song_name": song_name,
                "artist": artist,
                "play_count": play_count
            })
        
        return result

    except KeyboardInterrupt:
        print("\n⚠️  Keyboard Interrupt detected! Closing Chromedriver...")
        driver.quit()
        raise  # Re-raise the exception to exit the script properly

    finally:
        driver.quit()

if __name__ == "__main__":
    user_id = 354879837
    data_list = scrape_user_songs_rank(user_id)
    for idx, info in enumerate(data_list, start=1):
        print(f"{idx}. {info['song_name']} - {info['artist']} (播放次数:{info['play_count']})")