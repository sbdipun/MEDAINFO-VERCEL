import Busboy from 'busboy';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createWriteStream, unlinkSync } from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb'
  }
};

async function generateThumbnailFromFile(filePath, timestamp = 0, quality = 90) {
  try {
    // Using ffmpeg for high-quality thumbnail generation
    const outputPath = filePath + '_thumb.jpg';
    
    // Generate thumbnail at specified timestamp
    const command = `ffmpeg -i "${filePath}" -ss ${timestamp} -vframes 1 -q:v ${Math.max(1, Math.min(31, 31 - quality / 3.22))} -y "${outputPath}" 2>&1`;
    
    try {
      execSync(command, { stdio: 'pipe' });
    } catch (error) {
      console.log('FFmpeg output:', error.message);
    }
    
    // Read the generated thumbnail
    if (fs.existsSync(outputPath)) {
      const thumbnailBuffer = fs.readFileSync(outputPath);
      fs.unlinkSync(outputPath);
      fs.unlinkSync(filePath);
      
      return thumbnailBuffer;
    }
    
    throw new Error('Thumbnail generation failed');
  } catch (error) {
    // Cleanup
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
    }
    throw error;
  }
}

async function generateThumbnailFromUrl(url, timestamp = 0, quality = 90) {
  const tempFile = path.join('/tmp', `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  try {
    // Download the file
    const response = await fetch(url);
    const buffer = await response.buffer();
    
    // Save to temporary file
    fs.writeFileSync(tempFile, buffer);
    
    // Generate thumbnail
    return await generateThumbnailFromFile(tempFile, timestamp, quality);
  } catch (error) {
    if (fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {}
    }
    throw error;
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const contentType = req.headers['content-type'] || '';

      // Handle file upload
      if (contentType.includes('multipart/form-data')) {
        const bb = Busboy({ headers: req.headers });
        const files = [];
        const fields = {};
        let fileBuffer = null;
        let fileName = '';

        bb.on('file', (fieldname, file, info) => {
          const chunks = [];
          file.on('data', (data) => {
            chunks.push(data);
          });
          file.on('end', () => {
            fileBuffer = Buffer.concat(chunks);
            fileName = info.filename;
          });
        });

        bb.on('field', (fieldname, val) => {
          fields[fieldname] = val;
        });

        await new Promise((resolve, reject) => {
          bb.on('finish', resolve);
          bb.on('error', reject);
          req.pipe(bb);
        });

        if (!fileBuffer) {
          return res.status(400).json({
            success: false,
            error: 'No file uploaded'
          });
        }

        // Save temp file
        const tempFile = path.join('/tmp', `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
        fs.writeFileSync(tempFile, fileBuffer);

        const timestamp = parseInt(fields.timestamp || '0');
        const quality = parseInt(fields.quality || '90');

        // Generate thumbnail
        const thumbnailBuffer = await generateThumbnailFromFile(tempFile, timestamp, quality);

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', `attachment; filename="thumbnail.jpg"`);
        return res.send(thumbnailBuffer);

      } else {
        // Handle JSON with URL
        const { url, timestamp = 0, quality = 90 } = req.body;

        if (!url) {
          return res.status(400).json({
            success: false,
            error: 'URL is required'
          });
        }

        const thumbnailBuffer = await generateThumbnailFromUrl(url, timestamp, quality);

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="thumbnail.jpg"');
        return res.send(thumbnailBuffer);
      }

    } else if (req.method === 'GET') {
      return res.status(200).json({
        status: 'ok',
        message: 'Thumbnail Generator API is running',
        endpoints: {
          POST: '/api/thumbnail - Upload file or send JSON with URL'
        }
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
