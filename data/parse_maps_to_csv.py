import csv
import re
import time
import requests

input_csv = "Installations_Art Pieces-BBB '26 Digital Data.csv"
output_csv = "parsed_locations_output.csv"

# Читаем исходный CSV
urls_data = []
with open(input_csv, "r", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        url = row.get("GPS Coordinates/Link (from Location NEW)", "").strip()
        name = row.get("Project Name", "").strip()
        if url.startswith("http"):
            urls_data.append({"name": name, "url": url})

rows = []
# Заголовки для нового файла
rows.append(["Project Name", "Short URL", "Latitude", "Longitude"])

headers = {'User-Agent': 'Mozilla/5.0'}

for item in urls_data:
    url = item["url"]
    name = item["name"]
    try:
        # Ваш подход с использованием requests
        r = requests.get(url, allow_redirects=True, timeout=10, headers=headers)
        expanded = r.url
        
        # Регулярка из вашего скрипта:
        match = re.search(r'/@(-?\d+\.\d+),(-?\d+\.\d+)', expanded)
        # Также добавим отлов ?q=lat,lon на случай мобильных ссылок Google Maps
        if not match:
            match = re.search(r'\?q=(-?\d+\.\d+),(-?\d+\.\d+)', expanded)
            
        if match:
            lat, lon = match.group(1), match.group(2)
        else:
            lat, lon = "not found", "not found"
            
        rows.append([name, url, lat, lon])
        print(f"✅ {name}: {lat}, {lon}")
    except Exception as e:
        rows.append([name, url, "error", str(e)])
        print(f"❌ {url} — {e}")
    
    time.sleep(0.5)

# Сохраняем все сразу в CSV
with open(output_csv, "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)
    writer.writerows(rows)

print(f"✅ Готово! Данные сохранены в файл: {output_csv}")
