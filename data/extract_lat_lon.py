import csv
import urllib.request
import re
import urllib.error

input_file = "Installations_Art Pieces-BBB '26 Digital Data.csv"

def get_lat_lon(url):
    if not url or not url.startswith('http'):
        return '', ''
    try:
        # Use GET request for Google Maps redirect resolution
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        # We just need the resolved URL, we can close the response immediately
        with urllib.request.urlopen(req, timeout=10) as response:
            final_url = response.url
            
        print(f"Resolved {url} -> {final_url}")
        
        # Try to find ?q=lat,lon
        m = re.search(r'\?q=([\-\d\.]+),([\-\d\.]+)', final_url)
        if m:
            return m.group(1), m.group(2)
        
        # Try to find /@lat,lon
        m = re.search(r'/@([\-\d\.]+),([\-\d\.]+)', final_url)
        if m:
            return m.group(1), m.group(2)

    except Exception as e:
        print(f"Error resolving {url}: {e}")
    return '', ''

with open(input_file, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    
    # We will just append Latitude and Longitude to the end if they are not there
    if "Latitude" not in header:
        header.extend(["Latitude", "Longitude"])
    
    rows = []
    
    gps_idx = header.index('GPS Coordinates/Link (from Location NEW)')
    
    for row in reader:
        # pad row to the length of original header if it's short
        while len(row) < len(header) - 2:
            row.append('')
            
        if len(row) > gps_idx:
            url = row[gps_idx].strip()
            
            # If the row already has lat/lon appended
            if len(row) >= len(header):
                pass # Already has it? Wait, let's just always overwrite or add
            else:
                lat, lon = get_lat_lon(url)
                row.extend([lat, lon])
        else:
             row.extend(['', ''])
        rows.append(row)

with open(input_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(rows)

print("Finished extracting lat/lon and updated the CSV.")
