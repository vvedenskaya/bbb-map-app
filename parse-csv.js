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
      
      // Keep only items that have coords, or assign a random spread if none provided
      if (!coords) {
         coords = {
             lat: 33.352 + (Math.random() - 0.5) * 0.005,
             lng: -115.729 + (Math.random() - 0.5) * 0.005
         };
      }
      
      let typeLabel = row['Project Type'] ? row['Project Type'].trim() : 'Installation';
      
      parsedVenues.push({
          id: `art-${venueIdCounter++}`,
          name: row['Project Name'] ? row['Project Name'].trim() : (row['Artist Name'] || 'Untitled'),
          label: typeLabel,
          shortDescription: `By ${row['Artist Name'] || 'Unknown Artist'}`,
          description: row['Abridged Project Text'] || '',
          lat: coords.lat,
          lng: coords.lng,
          x: 0, 
          y: 0,
          thumbnailUrl: "/map-layers/image_BB_map.jpg",
          accent: "#bc5c2d" 
      });
  });

  constOutputPath = path.join(__dirname, 'src/data/parsed-venues.json');
  fs.writeFileSync(constOutputPath, JSON.stringify(parsedVenues, null, 2));
  console.log(`Success: Parsed ${parsedVenues.length} venues and saved to src/data/parsed-venues.json`);
  
} catch (e) {
  console.error("Error parsing CSV:", e);
}
