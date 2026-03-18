const fs = require('fs');
const path = require('path');

// A simple CSV parser since we don't have csv-parse installed
function parseCSV(text) {
  const result = [];
  let row = [];
  let inQuotes = false;
  let currentValue = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          currentValue += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentValue);
        currentValue = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') {
          i++; // Skip newline after carriage return
        }
        row.push(currentValue);
        result.push(row);
        row = [];
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
  }
  
  if (currentValue || row.length > 0) {
    row.push(currentValue);
    result.push(row);
  }
  
  return result;
}

try {
  const dataPath = path.join(__dirname, "data/Installations_Art Pieces-BBB '26 Digital Data.csv");
  const rawData = fs.readFileSync(dataPath, 'utf8');
  const rows = parseCSV(rawData);
  
  const headers = rows[0].map(h => h.trim());
  const records = rows.slice(1).map(row => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || '';
    });
    return record;
  });

  function extractCoordinates(input) {
    if (!input) return null;
    
    // Look for @33.351050,-115.732958 in URLs
    const linkMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (linkMatch) {
      return { lat: parseFloat(linkMatch[1]), lng: parseFloat(linkMatch[2]) };
    }
    
    // Look for raw coordinates 33.351050, -115.732958
    const coordMatch = input.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (coordMatch) {
      return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
    }
    
    return null;
  }

  const parsedVenues = [];
  let venueIdCounter = 1;

  records.forEach(row => {
      if (!row['Project Name'] && !row['Artist Name']) return; // Skip empty rows

      const gpsData = row['GPS Coordinates/Link (from Location NEW)'];
      let coords = extractCoordinates(gpsData);
      const hasLocation = !!coords;
      
      // Keep only items that have coords, or assign a random spread if none provided
      // So they still appear on the map for now. Wait, the user asked for a "No Location" toggle.
      // We will still place them centrally so they CAN be seen if toggled on, but mark them.
      if (!coords) {
         coords = {
             lat: 33.352 + (Math.random() - 0.5) * 0.005,
             lng: -115.729 + (Math.random() - 0.5) * 0.005
         };
      }
      
      const rawType = row['Project Type'] ? row['Project Type'].toLowerCase() : '';
      let typeId = 'installation';
      let accent = '#1e3a8a'; // installation dark blue
      
      if (rawType.includes('performance')) { typeId = 'performance'; accent = '#86efac'; }
      else if (rawType.includes('object')) { typeId = 'object'; accent = '#7dd3fc'; }
      else if (rawType.includes('experience') || rawType.includes('facilitated')) { typeId = 'experience'; accent = '#a855f7'; }
      else if (rawType.includes('dj')) { typeId = 'dj'; accent = '#fef08a'; }
      else if (rawType.includes('music')) { typeId = 'music'; accent = '#166534'; }
      else if (rawType.includes('venue')) { typeId = 'venue'; accent = '#8b5cf6'; }
      else if (rawType.includes('food')) { typeId = 'food'; accent = '#d8b4fe'; }
      
      parsedVenues.push({
          id: `art-${venueIdCounter++}`,
          name: row['Project Name'] ? row['Project Name'].trim() : (row['Artist Name'] || 'Untitled'),
          label: row['Project Type'] || 'Installation', // Original label
          shortDescription: `By ${row['Artist Name'] || 'Unknown Artist'}`,
          description: row['Abridged Project Text'] || '',
          lat: coords.lat,
          lng: coords.lng,
          hasLocation: hasLocation,
          permanence: row['Year or Permanent'] || '',
          x: 0, 
          y: 0,
          thumbnailUrl: "/map-layers/image_BB_map.jpg",
          accent: accent
      });
  });

  constOutputPath = path.join(__dirname, 'src/data/parsed-venues.json');
  fs.writeFileSync(constOutputPath, JSON.stringify(parsedVenues, null, 2));
  console.log(`Success: Parsed ${parsedVenues.length} venues and saved to src/data/parsed-venues.json`);
  
} catch (e) {
  console.error("Error parsing CSV:", e);
}
