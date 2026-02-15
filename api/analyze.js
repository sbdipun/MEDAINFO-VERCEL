import fetch from 'node-fetch';
import { MediaInfo } from 'mediainfo.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb'
    },
    responseLimit: false
  }
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ 
        error: 'URL is required' 
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ 
        error: 'Invalid URL format' 
      });
    }

    // Download first 10MB
    const buffer = await downloadFirst10MB(url);
    
    // Analyze with MediaInfo
    const mediaInfo = await analyzeMedia(buffer);
    
    // Get file info
    const fileInfo = await getFileInfo(url, buffer);

    return res.status(200).json({
      success: true,
      url: url,
      fileInfo: fileInfo,
      data: mediaInfo
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    // Handle specific errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(404).json({ 
        error: 'Unable to connect to the URL. Please check if the URL is accessible.' 
      });
    }
    
    if (error.code === 'ERR_INVALID_URL') {
      return res.status(400).json({ 
        error: 'Invalid URL provided.' 
      });
    }

    return res.status(500).json({ 
      error: error.message || 'Failed to analyze media file'
    });
  }
}

async function downloadFirst10MB(url) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const chunks = [];
  let downloaded = 0;

  try {
    // First try with range header
    const response = await fetch(url, {
      headers: {
        'Range': `bytes=0-${maxSize - 1}`,
        'User-Agent': 'Mozilla/5.0 (compatible; MediaInfo-Bot/1.0)'
      },
      timeout: 30000 // 30 second timeout
    });

    if (!response.ok && response.status !== 206) {
      // If range not supported, try regular download with limit
      console.log('Range not supported, using regular download...');
      const regularResponse = await fetch(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MediaInfo-Bot/1.0)'
        }
      });

      if (!regularResponse.ok) {
        throw new Error(`HTTP ${regularResponse.status}: ${regularResponse.statusText}`);
      }

      const reader = regularResponse.body.getReader();
      
      while (downloaded < maxSize) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = value.slice(0, maxSize - downloaded);
        chunks.push(chunk);
        downloaded += chunk.length;
        
        if (downloaded >= maxSize) break;
      }
      
      reader.releaseLock();
    } else {
      // Use ranged response
      const reader = response.body.getReader();
      
      while (downloaded < maxSize) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        downloaded += value.length;
      }
      
      reader.releaseLock();
    }

    // Check if we got any data
    if (downloaded === 0) {
      throw new Error('No data received from the URL');
    }

    // Combine chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const buffer = Buffer.concat(chunks, totalLength);
    
    return buffer;

  } catch (error) {
    console.error('Download error:', error);
    throw new Error(`Download failed: ${error.message}`);
  }
}

async function analyzeMedia(buffer) {
  try {
    const MediaInfoLib = await MediaInfo();
    
    const readChunk = (size, offset) => {
      return buffer.slice(offset, offset + size);
    };

    const result = await MediaInfoLib.analyzeData(
      () => buffer.length,
      readChunk
    );

    return JSON.parse(result);

  } catch (error) {
    console.error('MediaInfo error:', error);
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

async function getFileInfo(url, buffer) {
  try {
    const urlObj = new URL(url);
    const filename = urlObj.pathname.split('/').pop() || 'unknown';
    
    // Try to get content-type from HEAD request
    let contentType = 'application/octet-stream';
    try {
      const headResponse = await fetch(url, { method: 'HEAD', timeout: 5000 });
      contentType = headResponse.headers.get('content-type') || contentType;
    } catch {
      // Ignore HEAD request errors
    }

    return {
      filename: filename,
      size: buffer.length,
      sizeFormatted: formatBytes(buffer.length),
      contentType: contentType,
      downloadedSize: buffer.length,
      isPartial: buffer.length < 10485760 // Less than 10MB
    };

  } catch (error) {
    return {
      filename: 'unknown',
      size: buffer.length,
      sizeFormatted: formatBytes(buffer.length),
      downloadedSize: buffer.length,
      isPartial: true
    };
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
