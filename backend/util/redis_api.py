import redis
import json

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def get_data(key):
    res = redis_client.get(key)
    if res:
        return res.decode('utf-8')
    else:
        return ''


def write_data(key, val):
    res = redis_client.set(key, val)
    # print(res)
    return res


def insert_data(key, new_val):
    val = get_data(key)
    val = val+new_val
    res = write_data(key, val)
    return res


def update_data(key, old_val, new_val):
    val = get_data(key)
    val = val.replace(old_val, new_val)
    res = write_data(key, val)
    return res


def delete_data(key, delete_val):
    val = get_data(key)
    val = val.replace(delete_val, '')
    res = write_data(key, val)
    return res

def clear_data(key):
    write_data(key, '')

def delete_key(key):
    res = redis_client.delete(key)
    return res

# ======= hash api

def write_hash(key, field, val):
    res = redis_client.hset(key, field, val)
    return res

def get_hash(key, field):
    res = redis_client.hget(key, field)
    if res:
        return res.decode('utf-8')
    else:
        return ''

def insert_hash(key, field, new_val):
    val = get_hash(key, field)
    if new_val in val:
        return
    val = val+new_val
    res = write_hash(key, field, val)
    return res

def delete_hash(key, field):
    res = redis_client.hdel(key, field)
    return res

def remove_hash(key, field, delete_val):
    val = get_hash(key, field)
    val = val.replace(delete_val, '')
    res = write_hash(key, field, val)
    return res

def write_hash_list(key, field, vals=[]):
    # val = '@@@@'.join(vals)
    val = json.dumps(vals)
    res = write_hash(key, field, val)
    return res

def get_hash_list(key, field):
    val = get_hash(key, field)
    # vals = [i for i in val.split('@@@@') if i]  # so that empty result is [] instead of [']
    # if '@@@@' in val:
    #     vals = [i for i in val.split('@@@@') if i]  # so that empty result is [] instead of [']
    # else:
    #     vals = json.loads(val)
    if val:
        vals = json.loads(val)
    else:
        vals = []
    return vals

def insert_hash_list(key, field, new_vals=[]):
    vals = get_hash_list(key, field)
    # change new_nals into list if it is a string
    if isinstance(new_vals, str):
        new_vals = [new_vals]
    
    for val in new_vals:
        if val not in vals:
            vals += [val]
    # vals += new_vals
    res = write_hash_list(key, field, vals)
    return res

def remove_hash_list(key, field, del_vals=[]):
    vals = get_hash_list(key, field)
    for i in del_vals:
        vals.remove(i)
    res = write_hash_list(key, field, vals)
    return res

def clear_hash_list(key, field):
    res = delete_hash(key, field)
    return res

def get_all_hash(key):
    res = redis_client.hgetall(key)
    if res:
        result_decoded = {k.decode('utf-8'): v.decode('utf-8') for k, v in res.items()}
        return result_decoded
    else:
        return {}

def delete_all_hash(key):
    res = redis_client.delete(key)
    return res

# ======= store dataframe
def get_df_from_redis(name, date):
    df_json = get_hash(name, date)
    df = pd.read_json(df_json, orient='split')
    return df

def df_to_redis(df, name='', date='', overwrite=True, key=['']):
    df_json = df.to_json(orient='split')
    if not overwrite:   # DEDUP
        old_df = get_df_from_redis(name, date)
        df_combined = pd.concat([df, old_df])
        df = df_combined.drop_duplicates(subset=key, keep='first')

    write_hash(name, date, df_json)

def remove_room(room_name):
    delete_hash(f"playlist{redis_version}", room_name)



if __name__ == '__main__':
    # write_hash('test', 'test_val', 123)
    # print(get_hash("test", "test_val"))
    # print(get_all_hash('test'))

    room_name = 'eason'
    redis_version = '_v1'
    # playlist = get_hash(f"playlist{redis_version}", room_name)
    # settings = get_hash(f"settings{redis_version}", room_name)
    # introduction = get_hash(f"intro{redis_version}", room_name)

    # playlist = json.loads(get_hash(f"playlist{redis_version}", room_name))
    # settings = json.loads(get_hash(f"settings{redis_version}", room_name))
    # introduction = get_hash(f"intro{redis_version}", room_name)
    # print(f"playlist: {playlist}")
    # print(f"settings: {settings}")
    # print(f"introduction: {introduction}")    



    all_rooms = get_all_hash(f"playlist{redis_version}")
    print(all_rooms.keys())
    # remove_room('jj')
    # all_rooms = get_all_hash(f"playlist{redis_version}")
    # print(all_rooms.keys())
