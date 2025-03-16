## how to start

```./build.sh```

OR check the code in build.sh and run correspondingly.

## Installation

### NPM

```npm install```

On AWS Server:

```


### Redis

Mac:
```brew install redis```

```brew services start redis```

```brew services info redis```

```redis-cli```

```ping```

```brew services stop redis```

```redis-server```

<!-- setting at /usr/local/etc/redis.conf -->


## Online Serving

```screen -ls```
screen -r xxx
ctrl -A -D

### Change Log

- 2025-03-16
  - Add Google login
  - pending examination: gmail login redirect url verification: https://console.cloud.google.com/apis/credentials?project=halogen-eon-342923
  - pending ssl certificate: https://us-west-1.console.aws.amazon.com/acm/home?region=us-west-1#/certificates/4a849a04-5726-4e4b-aa81-c6bc74491be3
