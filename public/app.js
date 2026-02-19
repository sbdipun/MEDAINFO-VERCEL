
    .tabs {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        gap: 2px;
    }

    .tab {
        padding: 6px 10px;
        font-size: 11px;
        white-space: nowrap;
    }

    .sample-links {
        margin-top: 8px;
        padding-top: 8px;
    }

    .sample-link {
        padding: 4px 8px;
        font-size: 10px;
    }

    .error-box {
        padding: 10px;
        font-size: 12px;
    }

    .footer {
        font-size: 10px;
        padding: 10px;
        margin-top: 12px;
    }
}
    </style>
</head>

<body>
    <div class="container">
<div class="header">
    <h1>ðŸŽ¬ MediaInfo Analyzer</h1>
    <p>Powered by mediainfo.js on Vercel Serverless</p>
    <span class="badge" id="apiStatus">
        <span class="api-status status-offline" id="statusDot"></span>
        Checking Status...
    </span>
    <button class="theme-toggle" id="themeToggle" title="Toggle dark/light mode"></button>
</div>

<div class="content">
    <div class="tabs">
        <div class="tab active" data-tab="url">URL Analysis</div>
        <div class="tab" data-tab="upload">File Upload</div>
        <div class="tab" data-tab="thumbnails">Generate Thumbnails</div>
    </div>

    <div class="input-section" id="urlTab">
        <div class="url-input-group">
            <input type="url" class="url-input" id="urlInput"
                placeholder="Enter direct media URL (MP4, MKV, MP3, etc.)">
            <button class="analyze-btn" id="analyzeUrlBtn">
                <span class="btn-text">Analyze URL</span>
            </button>
        </div>
    </div>

    <div class="input-section" id="uploadTab" style="display: none;">
        <div class="url-input-group">
            <input type="file" class="file-input" id="fileInput"
                accept="video/*,audio/*,.mp4,.mkv,.avi,.mov,.mp3,.flac,.wav">
            <button class="analyze-btn" id="analyzeFileBtn">
                <span class="btn-text">Upload & Analyze</span>
            </button>
        </div>
        <p style="color: #666; font-size: 14px; margin-top: 10px;">
            ðŸ“ Max file size: 15MB (Vercel limit)
        </p>
    </div>

    <div class="input-section" id="thumbnailsTab" style="display: none;">
        <div class="thumbnail-controls">
            <div class="control-group">
                <label class="control-label">Number of Thumbnails</label>
                <input type="number" class="count-input" id="thumbnailCount" min="1" max="20" value="5">
            </div>
            <div class="control-group">
                <label class="control-label">Generation Mode</label>
                <div class="thumbnail-mode">
                    <label class="radio-option">
                        <input type="radio" name="thumbMode" value="random" checked>
                        <label style="margin: 0;">Random</label>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="thumbMode" value="timeline">
                        <label style="margin: 0;">Timeline</label>
                    </label>
                </div>
            </div>
        </div>
        <div class="url-input-group">
            <input type="file" class="file-input" id="thumbnailFileInput"
                accept="video/*,.mp4,.mkv,.avi,.mov,.webm,.flv">
            <button class="analyze-btn" id="generateThumbBtn">
                <span class="btn-text">Generate Thumbnails</span>
            </button>
        </div>
        <p style="color: #666; font-size: 14px; margin-top: 10px;">
            ðŸŽ¬ Select a video file and click Generate Thumbnails
        </p>
        <div id="thumbnailsGrid" class="thumbnails-grid" style="display: none;"></div>
    </div>

    <div class="progress-container" id="progressContainer">
        <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
        </div>
        <div class="status-text" id="statusText">Processing...</div>
    </div>

    <div class="info-cards" id="infoPanel" style="display: none;">
        <div class="info-card">
            <span class="info-icon">ðŸ“„</span>
            <div class="info-label">Filename</div>
            <div class="info-value" id="fileName">-</div>
        </div>
        <div class="info-card">
            <span class="info-icon">ðŸ’¾</span>
            <div class="info-label">Size</div>
            <div class="info-value" id="fileSize">-</div>
        </div>
        <div class="info-card">
            <span class="info-icon">âš¡</span>
            <div class="info-label">Overall Bitrate</div>
            <div class="info-value" id="overallBitrate">-</div>
        </div>
        <div class="info-card">
            <span class="info-icon">âœ…</span>
            <div class="info-label">Status</div>
            <div class="info-value" id="analysisStatus">Ready</div>
        </div>
        <div class="info-card">
            <span class="info-icon">ðŸ”—</span>
            <div class="info-label">Method</div>
            <div class="info-value" id="analysisMethod">-</div>
        </div>
    </div>

    <div class="results-section">
        <div class="results-header">
            <h2>ðŸ“Š Media Information</h2>
            <div style="display: flex; gap: 10px; align-items: center;">
                <div class="format-selector">
                    <button class="format-btn active" data-format="tree">Tree View</button>
                    <button class="format-btn" data-format="summary">Summary</button>
                </div>
                <button class="analyze-btn" id="copyBtn" style="padding: 8px 16px; font-size: 14px;"
                    title="Copy to clipboard">
                    ðŸ“‹ Copy
                </button>
            </div>
        </div>

        <div class="media-info-box" id="mediaInfoBox">
            <div class="skeleton-loader" id="skeletonLoader">
                <div class="skeleton-header"></div>
                <div class="skeleton-line long"></div>
                <div class="skeleton-line medium"></div>
                <div class="skeleton-line short"></div>
                <div class="skeleton-line long"></div>
                <div class="skeleton-line medium"></div>
                <div class="skeleton-header"></div>
                <div class="skeleton-line full"></div>
                <div class="skeleton-line long"></div>
                <div class="skeleton-line medium"></div>
                <div class="skeleton-line short"></div>
                <div class="skeleton-line long"></div>
                <div class="skeleton-line full"></div>
                <div class="skeleton-line medium"></div>
                <div class="skeleton-line short"></div>
                <div class="skeleton-header"></div>
                <div class="skeleton-line long"></div>
                <div class="skeleton-line medium"></div>
                <div class="skeleton-line short"></div>
                <div class="skeleton-line long"></div>
            </div>
            <pre id="mediaInfoContent">âš¡ Enter a URL or upload a file to analyze</pre>
        </div>
    </div>

    <div class="error-box" id="errorBox"></div>

    <div class="footer">
        <span id="footerStatus">Ready</span> | mediainfo.js v0.1.9 | Vercel Serverless
    </div>
</div>
    </div>

    <script src="formatter.js"></script>
    <script>
class MediaInfoAPIClient {
    constructor() {
        this.apiUrl = '/api/mediainfo';
        this.currentData = null;
        this.checkAPI();
    }

    async checkAPI() {
        try {
            const response = await fetch(this.apiUrl);
            if (response.ok) {
                document.getElementById('statusDot').className = 'api-status status-online';
                document.getElementById('apiStatus').innerHTML = '<span class="api-status status-online"></span> API Online';
            }
        } catch (error) {
            console.log('API check failed:', error);
        }
    }

    async analyzeFromUrl(url) {
        if (!this.isValidUrl(url)) {
            throw new Error('Please enter a valid URL');
        }

        this.showProgress(true);
        this.hideError();
        this.showSkeleton(true);
        document.getElementById('infoPanel').style.display = 'grid';
        this.updateStatus('Contacting API...', 'info');

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            const result = await response.json();

            this.currentData = result.data;

            // Update file info
            document.getElementById('fileName').textContent = result.fileInfo.filename;
            document.getElementById('fileSize').textContent = result.fileInfo.sizeFormatted;
            document.getElementById('analysisMethod').textContent = result.fileInfo.type;

            // Calculate overall bitrate: (fileSize * 8) / duration
            const tracks = result.data?.media?.track || [];
            const generalTrack = tracks.find(t => t['@type'] === 'General');
            const duration = generalTrack ? parseFloat(generalTrack.Duration) : 0;
            const fileSizeBytes = result.fileInfo.size;
            if (duration > 0 && fileSizeBytes > 0) {
                const bitrate = (fileSizeBytes * 8) / duration;
                document.getElementById('overallBitrate').textContent = MediaInfoFormatter.formatBitrate(bitrate);
            } else {
                document.getElementById('overallBitrate').textContent = '-';
            }

            this.displayResults(result.data);
            document.querySelector('.results-section').style.display = 'block';
            this.updateStatus('Analysis complete!', 'success');

            return result;

        } catch (error) {
            this.showError('Analysis failed: ' + error.message);
            this.updateStatus('Failed', 'error');
            throw error;
        } finally {
            this.showProgress(false);
        }
    }

    async analyzeFromFile(file) {
        if (!file) {
            throw new Error('Please select a file');
        }

        // Check file size (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
            throw new Error('File size exceeds 50MB limit');
        }

        this.showProgress(true);
        this.hideError();
        this.showSkeleton(true);
        document.getElementById('infoPanel').style.display = 'grid';
        this.updateStatus('Uploading file...', 'info');

        // Update file info
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileSize').textContent = this.formatBytes(file.size);
        document.getElementById('analysisMethod').textContent = 'upload';

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            const result = await response.json();

            this.currentData = result.data;

            // Calculate overall bitrate: (fileSize * 8) / duration
            const tracks = result.data?.media?.track || [];
            const generalTrack = tracks.find(t => t['@type'] === 'General');
            const duration = generalTrack ? parseFloat(generalTrack.Duration) : 0;
            if (duration > 0 && file.size > 0) {
                const bitrate = (file.size * 8) / duration;
                document.getElementById('overallBitrate').textContent = MediaInfoFormatter.formatBitrate(bitrate);
            } else {
                document.getElementById('overallBitrate').textContent = '-';
            }

            this.displayResults(result.data);
            document.querySelector('.results-section').style.display = 'block';
            this.updateStatus('Analysis complete!', 'success');

            return result;

        } catch (error) {
            this.showError('Upload failed: ' + error.message);
            this.updateStatus('Failed', 'error');
            throw error;
        } finally {
            this.showProgress(false);
        }
    }

    displayResults(data) {
        // Hide skeleton and show content
        this.showSkeleton(false);
        const contentEl = document.getElementById('mediaInfoContent');
        const activeFormat = document.querySelector('.format-btn.active').dataset.format;

        // Strip creatingLibrary and @ref â€” only use tracks
        const tracks = data?.media?.track || data;

        let displayText = '';

        switch (activeFormat) {
            case 'tree':
                displayText = this.formatAsTree(tracks);
                break;
            case 'summary':
                displayText = this.formatAsSummary(data);
                break;
        }

        contentEl.textContent = displayText;
    }

    formatAsTree(data, level = 0, parentKey = '') {
        if (!data) return '';

        const indent = '  '.repeat(level);
        let result = '';

        if (typeof data === 'object') {
            if (Array.isArray(data)) {
                // Check if this is a media track array
                const isTrackArray = (parentKey === 'track' || parentKey === '') && data.length > 0 && data[0]['@type'];

                data.forEach((item, index) => {
                    if (isTrackArray && item['@type']) {
                        // Format track header nicely
                        const trackType = item['@type'];
                        const typeOrder = item['@typeorder'];

                        let header = '';
                        if (trackType === 'General') {
                            header = 'â”â”â”â”â” General â”â”â”â”â”';
                        } else if (trackType === 'Video') {
                            header = 'â”â”â”â”â” Video â”â”â”â”â”';
                        } else if (trackType === 'Audio') {
                            const audioNum = typeOrder || index;
                            header = `â”â”â”â”â” Audio #${audioNum} â”â”â”â”â”`;
                        } else if (trackType === 'Text') {
                            const subNum = typeOrder || index;
                            header = `â”â”â”â”â” Subtitle #${subNum} â”â”â”â”â”`;
                        } else {
                            header = `â”â”â”â”â” ${trackType} â”â”â”â”â”`;
                        }

                        result += `${indent}${header}\n`;

                        // Format track contents, skip @type and @typeorder since we already used them
                        Object.entries(item).forEach(([key, value]) => {
                            if (key !== '@type' && key !== '@typeorder') {
                                if (value && typeof value === 'object') {
                                    result += `${indent}  ${key}:\n`;
                                    result += this.formatAsTree(value, level + 2, key);
                                } else {
                                    const formatted = MediaInfoFormatter.formatValue(key, value);
                                    result += `${indent}  ${key}: ${formatted}\n`;
                                }
                            }
                        });
                        result += '\n';
                    } else {
                        // Regular array item
                        result += `${indent}[${index}]:\n`;
                        result += this.formatAsTree(item, level + 1, parentKey);
                    }
                });
            } else {
                Object.entries(data).forEach(([key, value]) => {
                    if (value && typeof value === 'object') {
                        result += `${indent}${key}:\n`;
                        result += this.formatAsTree(value, level + 1, key);
                    } else {
                        const formatted = MediaInfoFormatter.formatValue(key, value);
                        result += `${indent}${key}: ${formatted}\n`;
                    }
                });
            }
        } else {
            result += `${indent}${data}\n`;
        }

        return result;
    }

    formatAsSummary(data) {
        let summary = '';

        try {
            const tracks = data?.media?.track || [];

            tracks.forEach(track => {
                const type = track['@type'];

                summary += `â”â”â” ${type} Track â”â”â”\n`;

                if (type === 'General') {
                    summary += `ðŸ“ Format: ${track.Format || 'Unknown'}\n`;
                    summary += `â±ï¸  Duration: ${track.Duration ? MediaInfoFormatter.formatDuration(parseFloat(track.Duration)) : 'Unknown'}\n`;
                    summary += `ðŸ’¾ Size: ${this.formatBytes(parseInt(track.FileSize) || 0)}\n`;
                    summary += `ðŸ“Š Bit Rate: ${MediaInfoFormatter.formatBitrate(parseFloat(track.OverallBitRate) || 0)}\n`;
                } else if (type === 'Video') {
                    summary += `ðŸŽ¬ Codec: ${track.Format || 'Unknown'}\n`;
                    summary += `ðŸ“ Resolution: ${track.Width || '?'}x${track.Height || '?'}\n`;
                    summary += `âš¡ Frame Rate: ${track.FrameRate || 'Unknown'} fps\n`;
                    summary += `ðŸ“Š Bit Rate: ${track.BitRate ? MediaInfoFormatter.formatBitrate(parseFloat(track.BitRate)) : 'Unknown'}\n`;
                } else if (type === 'Audio') {
                    summary += `ðŸŽµ Codec: ${track.Format || 'Unknown'}\n`;
                    summary += `ðŸ”Š Channels: ${track.Channels || 'Unknown'}\n`;
                    summary += `ï¿½ Language: ${MediaInfoFormatter.formatLanguage(track.Language) || 'Unknown'}\n`;
                    summary += `ï¿½ðŸŽšï¸  Sample Rate: ${track.SamplingRate || 'Unknown'} Hz\n`;
                    summary += `ðŸ“Š Bit Rate: ${MediaInfoFormatter.formatBitrate(parseFloat(track.BitRate) || 0)}\n`;
                } else if (type === 'Text') {
                    summary += `ðŸ“ Format: ${track.Format || 'Unknown'}\n`;
                    summary += `ðŸŒ Language: ${MediaInfoFormatter.formatLanguage(track.Language) || 'Unknown'}\n`;
