// services/kml.js
function escapeXml(s = '') {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  
  function buildKml(spots, userId) {
    const header = `<?xml version="1.0" encoding="UTF-8"?>
  <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
    <name>My Spots</name>
    <Style id="ownerStyle">
      <IconStyle>
        <color>ff00a000</color>
        <scale>1.1</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="sharedStyle">
      <IconStyle>
        <color>ffa000ff</color>
        <scale>1.1</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon>
      </IconStyle>
    </Style>
  `;
    const body = spots.map(s => {
      const c = s.coordinates;
      if (!c || typeof c.lat !== 'number' || typeof c.lon !== 'number') return '';
      const owned = String(s.ownerId || s.userId) === userId;
      const styleUrl = owned ? '#ownerStyle' : '#sharedStyle';
      const name = escapeXml(s.title || 'Spot');
      const desc = escapeXml(s.description || '');
      return `  <Placemark>
      <name>${name}</name>
      ${desc ? `<description>${desc}</description>` : ''}
      <styleUrl>${styleUrl}</styleUrl>
      <Point><coordinates>${c.lon},${c.lat},0</coordinates></Point>
    </Placemark>
  `;
    }).join('');
    const footer = '</Document></kml>';
    return header + body + footer;
  }
  
  module.exports = { buildKml };