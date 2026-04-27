
import requests

url_base = "https://calendar.google.com/calendar/embed"
params = {
    "src": "c_b4bcc812942bb077ea217b6ce5f95fb8dd5cc0bdc069d0a4d3b1b1181a69c97d@group.calendar.google.com",
    "ctz": "Pacific/Auckland",
    "showTitle": "0",
    "showNav": "1",
    "showDate": "1",
    "showPrint": "0",
    "showTabs": "0",
    "showCalendars": "0",
    "showTz": "0",
    "mode": "MONTH",
    "bgcolor": "#0b0b0d",
    "color": "#C9A96E"
}

def test_url(p):
    resp = requests.get(url_base, params=p)
    print(f"Status: {resp.status_code}, URL: {resp.url}")
    if resp.status_code == 400:
        print("FAILED!")

print("Testing full params:")
test_url(params)

print("\nTesting without colors:")
p2 = params.copy()
del p2["bgcolor"]
del p2["color"]
test_url(p2)

print("\nTesting without showCalendars:")
p3 = params.copy()
del p3["showCalendars"]
test_url(p3)

print("\nTesting with raw src string as in HTML (encoded):")
raw_url = "https://calendar.google.com/calendar/embed?src=c_b4bcc812942bb077ea217b6ce5f95fb8dd5cc0bdc069d0a4d3b1b1181a69c97d%40group.calendar.google.com&ctz=Pacific%2FAuckland&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&showTz=0&mode=MONTH&bgcolor=%230b0b0d&color=%23C9A96E"
resp = requests.get(raw_url)
print(f"Status: {resp.status_code}")
