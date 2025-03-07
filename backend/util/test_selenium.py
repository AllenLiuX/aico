from selenium import webdriver
from selenium.webdriver.chrome.service import Service

options = webdriver.ChromeOptions()
options.add_argument("--headless")  # AWS 服务器必须 headless
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

service = Service("/usr/local/bin/chromedriver")  # 指定手动安装的 chromedriver
driver = webdriver.Chrome(service=service, options=options)

driver.get("https://www.google.com")
print(driver.title)

driver.quit()
