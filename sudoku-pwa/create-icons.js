/**
 * Icon Generation Script for Sudoku PWA
 *
 * Run this script with Node.js to generate PNG icons:
 *   node create-icons.js
 *
 * Or open generate-icons.html in a browser for a visual interface.
 *
 * If you don't want to run scripts, you can also use online tools:
 * 1. Go to https://realfavicongenerator.net
 * 2. Upload the icon.svg file
 * 3. Download and extract the generated icons
 */

const fs = require('fs');
const path = require('path');

// Simple inline PNG generator for basic colored squares
// These will work as placeholders until proper icons are generated

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Create a simple PNG with a colored background
// This is a minimal PNG implementation for placeholder icons
function createSimplePNG(size) {
    // PNG signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk
    const width = size;
    const height = size;
    const bitDepth = 8;
    const colorType = 2; // RGB
    const compression = 0;
    const filter = 0;
    const interlace = 0;

    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData.writeUInt8(bitDepth, 8);
    ihdrData.writeUInt8(colorType, 9);
    ihdrData.writeUInt8(compression, 10);
    ihdrData.writeUInt8(filter, 11);
    ihdrData.writeUInt8(interlace, 12);

    const ihdrChunk = createChunk('IHDR', ihdrData);

    // IDAT chunk (image data)
    // Create blue gradient background
    const rawData = [];
    for (let y = 0; y < height; y++) {
        rawData.push(0); // Filter byte
        for (let x = 0; x < width; x++) {
            // Create a gradient from #4a90d9 to #357abd
            const t = (x + y) / (width + height);
            const r = Math.round(74 + (53 - 74) * t);
            const g = Math.round(144 + (122 - 144) * t);
            const b = Math.round(217 + (189 - 217) * t);
            rawData.push(r, g, b);
        }
    }

    const zlib = require('zlib');
    const compressedData = zlib.deflateSync(Buffer.from(rawData));
    const idatChunk = createChunk('IDAT', compressedData);

    // IEND chunk
    const iendChunk = createChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const typeBuffer = Buffer.from(type);
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = crc32(crcData);

    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc >>> 0, 0);

    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation
function crc32(buffer) {
    let crc = 0xffffffff;
    const table = makeCRCTable();

    for (let i = 0; i < buffer.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xff];
    }

    return crc ^ 0xffffffff;
}

function makeCRCTable() {
    const table = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c;
    }
    return table;
}

// Main function
async function generateIcons() {
    const iconsDir = path.join(__dirname, 'icons');

    // Ensure icons directory exists
    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
    }

    console.log('Generating placeholder PNG icons...\n');

    for (const size of SIZES) {
        const filename = `icon-${size}x${size}.png`;
        const filepath = path.join(iconsDir, filename);

        try {
            const png = createSimplePNG(size);
            fs.writeFileSync(filepath, png);
            console.log(`✓ Created ${filename}`);
        } catch (error) {
            console.error(`✗ Failed to create ${filename}: ${error.message}`);
        }
    }

    console.log('\n✓ Placeholder icons generated!');
    console.log('\nFor better quality icons with the Sudoku grid design:');
    console.log('1. Open icons/generate-icons.html in a browser');
    console.log('2. Click "Generate All Icons"');
    console.log('3. Click "Download All Icons"');
    console.log('4. Replace the placeholder PNGs with the downloaded ones');
}

// Check if we can run this
if (typeof require !== 'undefined') {
    try {
        generateIcons();
    } catch (error) {
        console.error('Error generating icons:', error.message);
        console.log('\nAlternative: Open icons/generate-icons.html in a browser');
    }
}
