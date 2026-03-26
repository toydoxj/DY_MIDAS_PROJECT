import requests
import sys
import time

class MIDAS_API_BASEURL:
    def __init__(self, baseURL:str):
        MIDAS_API_BASEURL.baseURL = baseURL

    @classmethod
    def get_url(cls):
        return MIDAS_API_BASEURL.baseURL

class MIDAS_API_KEY:
    def __init__(self, api_Key:str):
        MIDAS_API_KEY.api_Key = api_Key

    @classmethod
    def get_key(cls):
        return MIDAS_API_KEY.api_Key

def MidasAPI(method:str, command:str, body:dict={})->dict:
    # 1순위: ContextVar에 MidasClient가 설정된 경우 해당 인스턴스 사용
    from ._client import MidasClient
    _ctx_client = MidasClient.get_current()
    if _ctx_client is not None:
        return _ctx_client.request(method, command, body)

    # 2순위: 기존 전역 클래스 변수 방식 (하위 호환)
    base_url = MIDAS_API_BASEURL.get_url()
    url = base_url + command
    key = MIDAS_API_KEY.get_key()
    headers = {
        "Content-Type": "application/json",
        "MAPI-Key" : key
    }

    start_time = time.perf_counter()

    if method == "POST":
        response = requests.post(url, headers=headers, json=body)
    elif method == "GET":
        response = requests.get(url, headers=headers)
    elif method == "PUT":
        response = requests.put(url, headers=headers, json=body)
    elif method == "DELETE":
        response = requests.delete(url, headers=headers)
    else:
        raise ValueError(f"Invalid method: {method}")

    end_time = time.perf_counter()
    elapsed_time = end_time - start_time

    print(f"Time taken: {elapsed_time:.2f} seconds")

    return response.json()

