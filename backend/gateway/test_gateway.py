import httpx
import asyncio
import os

GATEWAY_URL = "http://localhost:8000/api"
AUTH_TOKEN = "bridge-dev-token-123"
HEADERS = {"Authorization": f"Bearer {AUTH_TOKEN}"}

# Mock file paths (make sure these exist or copy them from earlier tests)
TEST_AUDIO = r"d:\bridgeapp\4_output_layer\tts_api\audio\tts_139e6e8f-d95c-4233-a4c1-b216eb1aed46.mp3"
TEST_VIDEO = r"d:\bridgeapp\2_ai_processing_layer\sign_recognition_api\test_video.avi"

async def test_speech_to_sign():
    print("\n--- Testing Speech-to-Sign Workflow ---")
    if not os.path.exists(TEST_AUDIO):
        print(f"Skipping: {TEST_AUDIO} not found.")
        return

    with open(TEST_AUDIO, "rb") as f:
        files = {"audio": (TEST_AUDIO, f, "audio/mpeg")}
        async with httpx.AsyncClient(timeout=180.0) as client:
            res = await client.post(f"{GATEWAY_URL}/speech-to-sign", headers=HEADERS, files=files)
            print(f"Status Code: {res.status_code}")
            if res.status_code == 200:
                print("Response:", res.json())
            else:
                print("Error Details:", res.text)

async def test_sign_to_speech():
    print("\n--- Testing Sign-to-Speech Workflow ---")
    if not os.path.exists(TEST_VIDEO):
        print(f"Skipping: {TEST_VIDEO} not found.")
        return

    with open(TEST_VIDEO, "rb") as f:
        files = {"video": (TEST_VIDEO, f, "video/avi")}
        async with httpx.AsyncClient(timeout=180.0) as client:
            res = await client.post(f"{GATEWAY_URL}/sign-to-speech", headers=HEADERS, files=files)
            print(f"Status Code: {res.status_code}")
            if res.status_code == 200:
                print("Response:", res.json())
            else:
                print("Error Details:", res.text)

async def test_text_proxies():
    print("\n--- Testing Text Proxies ---")
    async with httpx.AsyncClient(timeout=180.0) as client:
        # text-to-sign
        res_t2s = await client.post(f"{GATEWAY_URL}/text-to-sign", headers=HEADERS, data={"text": "hello"})
        print("Text-to-Sign Response:", res_t2s.status_code, res_t2s.text)

        # text-to-speech
        res_t2sp = await client.post(f"{GATEWAY_URL}/text-to-speech", headers=HEADERS, data={"text": "hello"})
        print("Text-to-Speech Response:", res_t2sp.status_code, res_t2sp.text)

async def main():
    print("Testing Gateway API...")
    await test_text_proxies()
    await test_speech_to_sign()
    await test_sign_to_speech()

if __name__ == "__main__":
    asyncio.run(main())
