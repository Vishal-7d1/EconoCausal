import requests

url = "http://127.0.0.1:8000/api/dataset/upload"
with open("01_Dataset_Analysis/cleaned_pricing_data.csv", "rb") as f:
    files = {"file": ("cleaned_pricing_data.csv", f, "text/csv")}
    res = requests.post(url, files=files)
    print("Status:", res.status_code)
    print("Response:", res.json())
