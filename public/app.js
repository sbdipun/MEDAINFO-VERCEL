(() => {
  class MediaInfoAPIClient {
    constructor() {
      this.apiUrl = '/api/mediainfo';
      this.currentData = null;
      this.checkAPI();
    }

    async checkAPI() {
      const statusDot = document.getElementById('statusDot');
      const apiStatus = document.getElementById('apiStatus');
      if (!statusDot || !apiStatus) return;

      try {
        const response = await fetch(this.apiUrl, { method: 'GET' });
        if (response.ok) {
          statusDot.className = 'api-status status-online';
          apiStatus.innerHTML = '<span class="api-status status-online"></span> API Online';
        } else {
          statusDot.className = 'api-status status-offline';
          apiStatus.innerHTML = '<span class="api-status status-offline"></span> API Offline';
        }
      } catch (_error) {
        statusDot.className = 'api-status status-offline';
        apiStatus.innerHTML = '<span class="api-status status-offline"></span> API Offline';
      }
    }

    async analyzeFromUrl(url) {
      if (!this.isValidUrl(url)) {
        throw new Error('Please enter a valid URL.');
      }

      this.showProgress(true, 'Analyzing URL...');
      this.hideError();
      this.showSkeleton(true);
      this.showInfoPanel(true);
      this.updateStatus('Contacting API...', 'info');

      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const result = await this.parseResponse(response);

        this.currentData = result.data;
        this.fillFileInfo(result.fileInfo || {});
        this.displayResults(this.currentData);
        this.updateStatus('Analysis complete!', 'success');

        return result;
      } catch (error) {
        this.showError(`Analysis failed: ${error.message}`);
        this.updateStatus('Failed', 'error');
        throw error;
      } finally {
        this.showProgress(false);
      }
    }

    async generateThumbnailsFromUrl(url, count = 5) {
      if (!this.isValidUrl(url)) {
        throw new Error('Please enter a valid URL.');
      }
      const safeCount = Math.max(1, Math.min(8, parseInt(count, 10) || 5));

      this.showProgress(true, 'Generating thumbnails...');
      this.hideError();
      this.updateStatus('Generating thumbnails...', 'info');

      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generateThumbnails',
            url,
            count: safeCount,
            mode: 'random'
          })
        });
        const result = await this.parseResponse(response);

        return result.thumbnails || [];
      } catch (error) {
        this.showError(`Thumbnail generation failed: ${error.message}`);
        this.updateStatus('Failed', 'error');
        throw error;
      } finally {
        this.showProgress(false);
      }
    }

    async analyzeFromFile(file) {
      if (!file) {
        throw new Error('Please select a file.');
      }

      if (file.size > 50 * 1024 * 1024) {
        throw new Error('File size exceeds 50MB limit.');
      }

      this.showProgress(true, 'Uploading and analyzing file...');
      this.hideError();
      this.showSkeleton(true);
      this.showInfoPanel(true);
      this.updateStatus('Uploading file...', 'info');

      const fileNameEl = document.getElementById('fileName');
      const fileSizeEl = document.getElementById('fileSize');
      const methodEl = document.getElementById('analysisMethod');
      if (fileNameEl) fileNameEl.textContent = file.name;
      if (fileSizeEl) fileSizeEl.textContent = this.formatBytes(file.size);
      if (methodEl) methodEl.textContent = 'upload';

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(this.apiUrl, {
          method: 'POST',
          body: formData
        });
        const result = await this.parseResponse(response);

        this.currentData = result.data;
        this.fillFileInfo(result.fileInfo || {}, file.size);
        this.displayResults(this.currentData);
        this.updateStatus('Analysis complete!', 'success');

        return result;
      } catch (error) {
        this.showError(`Upload failed: ${error.message}`);
        this.updateStatus('Failed', 'error');
        throw error;
      } finally {
        this.showProgress(false);
      }
    }

    async compareThumbnailPairs(urlA, urlB, count = 4) {
      if (!this.isValidUrl(urlA) || !this.isValidUrl(urlB)) {
        throw new Error('Please enter two valid URLs.');
      }
      const safeCount = Math.max(1, Math.min(8, parseInt(count, 10) || 4));

      this.showProgress(true, 'Comparing thumbnails...');
      this.hideError();
      this.updateStatus('Generating comparison pairs...', 'info');

      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'compareThumbnails',
            urlA,
            urlB,
            count: safeCount,
            mode: 'random'
          })
        });
        const result = await this.parseResponse(response);
        return result.pairs || [];
      } catch (error) {
        this.showError(`Comparison failed: ${error.message}`);
        this.updateStatus('Failed', 'error');
        throw error;
      } finally {
        this.showProgress(false);
      }
    }

    async parseResponse(response) {
      const raw = await response.text();
      let parsed;

      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch (_error) {
        const preview = (raw || '').replace(/\s+/g, ' ').slice(0, 180);
        throw new Error(`Server returned non-JSON response (HTTP ${response.status}): ${preview || 'empty body'}`);
      }

      if (!response.ok) {
        throw new Error(parsed.error || parsed.message || `HTTP ${response.status}`);
      }

      return parsed;
    }

    fillFileInfo(fileInfo, fallbackSize = 0) {
      const fileNameEl = document.getElementById('fileName');
      const fileSizeEl = document.getElementById('fileSize');
      const methodEl = document.getElementById('analysisMethod');
      const bitrateEl = document.getElementById('overallBitrate');

      if (fileNameEl) fileNameEl.textContent = fileInfo.filename || 'Unknown';
      if (fileSizeEl) {
        fileSizeEl.textContent = fileInfo.sizeFormatted || this.formatBytes(fileInfo.size || fallbackSize);
      }
      if (methodEl) methodEl.textContent = fileInfo.type || '-';

      const tracks = this.currentData?.media?.track || [];
      const generalTrack = tracks.find((t) => t['@type'] === 'General');
      const duration = generalTrack ? parseFloat(generalTrack.Duration) : 0;
      const size = fileInfo.size || fallbackSize;

      if (bitrateEl) {
        if (duration > 0 && size > 0 && window.MediaInfoFormatter) {
          bitrateEl.textContent = MediaInfoFormatter.formatBitrate((size * 8) / duration);
        } else {
          bitrateEl.textContent = '-';
        }
      }
    }

    displayResults(data) {
      this.showSkeleton(false);

      const contentEl = document.getElementById('mediaInfoContent');
      const activeFormatBtn = document.querySelector('.format-btn.active');
      const resultsSection = document.querySelector('.results-section');
      if (!contentEl || !activeFormatBtn || !resultsSection) return;

      const format = activeFormatBtn.dataset.format;
      const tracks = data?.media?.track || data;

      let text = '';
      if (format === 'summary') {
        text = this.formatAsSummary(data);
      } else {
        text = this.formatAsTree(tracks);
      }

      contentEl.textContent = text || 'No media info returned.';
      resultsSection.style.display = 'block';
    }

    formatAsTree(data, level = 0, parentKey = '') {
      if (!data) return '';

      const indent = '  '.repeat(level);
      let out = '';

      if (Array.isArray(data)) {
        const isTrackArray = (parentKey === 'track' || parentKey === '') && data[0] && data[0]['@type'];

        data.forEach((item, i) => {
          if (isTrackArray && item['@type']) {
            const type = item['@type'];
            const order = item['@typeorder'] || i;
            let title = type;
            if (type === 'Audio') title = `Audio #${order}`;
            if (type === 'Text') title = `Subtitle #${order}`;

            out += `${indent}----- ${title} -----\n`;

            Object.entries(item).forEach(([key, value]) => {
              if (key === '@type' || key === '@typeorder') return;

              if (value && typeof value === 'object') {
                out += `${indent}  ${key}:\n`;
                out += this.formatAsTree(value, level + 2, key);
              } else {
                out += `${indent}  ${key}: ${this.formatValue(key, value)}\n`;
              }
            });
            out += '\n';
          } else {
            out += `${indent}[${i}]:\n`;
            out += this.formatAsTree(item, level + 1, parentKey);
          }
        });

        return out;
      }

      if (typeof data === 'object') {
        Object.entries(data).forEach(([key, value]) => {
          if (value && typeof value === 'object') {
            out += `${indent}${key}:\n`;
            out += this.formatAsTree(value, level + 1, key);
          } else {
            out += `${indent}${key}: ${this.formatValue(key, value)}\n`;
          }
        });
        return out;
      }

      return `${indent}${data}\n`;
    }

    formatAsSummary(data) {
      const tracks = data?.media?.track || [];
      if (!tracks.length) return 'No track summary available.';

      let out = '';
      tracks.forEach((track) => {
        const type = track['@type'] || 'Unknown';
        out += `--- ${type} Track ---\n`;

        if (type === 'General') {
          out += `Format: ${track.Format || 'Unknown'}\n`;
          out += `Duration: ${track.Duration ? this.formatDuration(track.Duration) : 'Unknown'}\n`;
          out += `Size: ${this.formatBytes(parseInt(track.FileSize || '0', 10))}\n`;
          out += `Bit Rate: ${this.formatBitrate(track.OverallBitRate)}\n`;
        } else if (type === 'Video') {
          out += `Codec: ${track.Format || 'Unknown'}\n`;
          out += `Resolution: ${track.Width || '?'}x${track.Height || '?'}\n`;
          out += `Frame Rate: ${track.FrameRate || 'Unknown'} fps\n`;
          out += `Bit Rate: ${this.formatBitrate(track.BitRate)}\n`;
        } else if (type === 'Audio') {
          out += `Codec: ${track.Format || 'Unknown'}\n`;
          out += `Channels: ${track.Channels || 'Unknown'}\n`;
          out += `Language: ${this.formatLanguage(track.Language)}\n`;
          out += `Sample Rate: ${track.SamplingRate || 'Unknown'} Hz\n`;
          out += `Bit Rate: ${this.formatBitrate(track.BitRate)}\n`;
        } else if (type === 'Text') {
          out += `Format: ${track.Format || 'Unknown'}\n`;
          out += `Language: ${this.formatLanguage(track.Language)}\n`;
        }

        out += '\n';
      });

      return out;
    }

    formatValue(key, value) {
      if (window.MediaInfoFormatter && typeof MediaInfoFormatter.formatValue === 'function') {
        return MediaInfoFormatter.formatValue(key, value);
      }
      return value;
    }

    formatDuration(seconds) {
      const n = parseFloat(seconds);
      if (Number.isNaN(n)) return 'Unknown';
      if (window.MediaInfoFormatter) return MediaInfoFormatter.formatDuration(n);

      const hrs = Math.floor(n / 3600);
      const mins = Math.floor((n % 3600) / 60);
      const secs = Math.floor(n % 60);
      return hrs > 0 ? `${hrs}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
    }

    formatBitrate(bps) {
      const n = parseFloat(bps);
      if (Number.isNaN(n) || n <= 0) return 'Unknown';
      if (window.MediaInfoFormatter) return MediaInfoFormatter.formatBitrate(n);
      return `${Math.round(n / 1000)} Kbps`;
    }

    formatLanguage(code) {
      if (window.MediaInfoFormatter) return MediaInfoFormatter.formatLanguage(code) || 'Unknown';
      return code || 'Unknown';
    }

    showProgress(show, text = 'Processing...') {
      const container = document.getElementById('progressContainer');
      const statusText = document.getElementById('statusText');
      const fill = document.getElementById('progressFill');
      if (!container || !statusText || !fill) return;

      container.style.display = show ? 'block' : 'none';
      statusText.textContent = text;
      fill.style.width = show ? '70%' : '0%';
    }

    showSkeleton(show) {
      const skeleton = document.getElementById('skeletonLoader');
      const content = document.getElementById('mediaInfoContent');
      if (!skeleton || !content) return;

      skeleton.style.display = show ? 'block' : 'none';
      content.style.display = show ? 'none' : 'block';
    }

    showInfoPanel(show) {
      const panel = document.getElementById('infoPanel');
      if (panel) panel.style.display = show ? 'grid' : 'none';
    }

    showError(message) {
      const errorEl = document.getElementById('errorBox');
      if (!errorEl) return;
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }

    hideError() {
      const errorEl = document.getElementById('errorBox');
      if (!errorEl) return;
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }

    updateStatus(message) {
      const footerStatus = document.getElementById('footerStatus');
      const analysisStatus = document.getElementById('analysisStatus');
      if (footerStatus) footerStatus.textContent = message;
      if (analysisStatus) analysisStatus.textContent = message;
    }

    formatBytes(bytes) {
      const n = Number(bytes);
      if (!Number.isFinite(n) || n <= 0) return '0 Bytes';
      const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(n) / Math.log(1024));
      return `${(n / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
    }

    isValidUrl(value) {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch (_error) {
        return false;
      }
    }
  }

  function setButtonLoading(button, loading, label) {
    if (!button) return;
    const textEl = button.querySelector('.btn-text');
    button.disabled = loading;
    if (textEl && label) {
      textEl.textContent = loading ? 'Working...' : label;
    }
  }

  function setupTabs() {
    const tabs = Array.from(document.querySelectorAll('.tab'));
    const map = {
      url: document.getElementById('urlTab'),
      upload: document.getElementById('uploadTab')
    };

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');

        Object.entries(map).forEach(([key, el]) => {
          if (!el) return;
          el.style.display = key === target ? 'block' : 'none';
        });
      });
    });
  }

  function setupThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.body.classList.add('dark');
    }

    toggle.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const current = document.body.classList.contains('dark') ? 'dark' : 'light';
      localStorage.setItem('theme', current);
    });
  }

  function setupCopyButton() {
    const copyBtn = document.getElementById('copyBtn');
    const contentEl = document.getElementById('mediaInfoContent');
    if (!copyBtn || !contentEl) return;

    copyBtn.addEventListener('click', async () => {
      const text = contentEl.textContent || '';
      try {
        await navigator.clipboard.writeText(text);
        const previous = copyBtn.textContent;
        copyBtn.textContent = 'Copied';
        setTimeout(() => {
          copyBtn.textContent = previous;
        }, 1200);
      } catch (_error) {
        alert('Clipboard copy failed.');
      }
    });
  }

  function setupFormatButtons(client) {
    const buttons = Array.from(document.querySelectorAll('.format-btn'));
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        if (client.currentData) {
          client.displayResults(client.currentData);
        }
      });
    });
  }

  function renderThumbnails(thumbnails) {
    const grid = document.getElementById('thumbnailsGrid');
    if (!grid) return;

    if (!thumbnails || !thumbnails.length) {
      grid.style.display = 'none';
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = '';
    thumbnails.forEach((t) => {
      const item = document.createElement('div');
      item.className = 'thumbnail-item';

      const img = document.createElement('img');
      img.className = 'thumbnail-img';
      img.alt = `Thumbnail at ${t.timestamp || ''}`;
      img.src = t.data;

      const info = document.createElement('div');
      info.className = 'thumbnail-info';
      const label = document.createElement('div');
      label.className = 'thumbnail-timestamp';
      label.textContent = t.timestamp || '';
      info.appendChild(label);

      const download = document.createElement('button');
      download.className = 'thumbnail-download';
      download.type = 'button';
      download.textContent = 'Download';
      download.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = t.data;
        a.download = `thumbnail-${t.index || 0}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });

      const preview = document.createElement('button');
      preview.className = 'thumbnail-preview';
      preview.type = 'button';
      preview.textContent = 'Preview';
      preview.addEventListener('click', () => {
        window.openPreviewModal(t.data, `Thumbnail ${t.index || ''} • ${t.timestamp || ''}`);
      });

      item.appendChild(img);
      item.appendChild(preview);
      item.appendChild(download);
      item.appendChild(info);
      grid.appendChild(item);
    });

    grid.style.display = 'grid';
  }

  function renderComparePairs(pairs) {
    const grid = document.getElementById('compareGrid');
    if (!grid) return;

    if (!pairs || !pairs.length) {
      grid.style.display = 'none';
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = '';
    pairs.forEach((pair) => {
      const card = document.createElement('div');
      card.className = 'compare-item';

      const label = document.createElement('div');
      label.className = 'compare-label';
      label.textContent = pair.timestamp || '';

      const row = document.createElement('div');
      row.className = 'compare-row';

      const colA = document.createElement('div');
      colA.className = 'compare-col';
      const titleA = document.createElement('div');
      titleA.className = 'compare-title';
      titleA.textContent = 'URL A';
      const imgA = document.createElement('img');
      imgA.className = 'compare-img';
      imgA.src = pair.imageA;
      imgA.alt = `URL A at ${pair.timestamp || ''}`;
      imgA.addEventListener('click', () => {
        window.openComparePreviewModal(
          pair.imageA,
          pair.imageB,
          `Compare • ${pair.timestamp || ''}`,
          'URL A',
          'URL B'
        );
      });
      colA.appendChild(titleA);
      colA.appendChild(imgA);

      const colB = document.createElement('div');
      colB.className = 'compare-col';
      const titleB = document.createElement('div');
      titleB.className = 'compare-title';
      titleB.textContent = 'URL B';
      const imgB = document.createElement('img');
      imgB.className = 'compare-img';
      imgB.src = pair.imageB;
      imgB.alt = `URL B at ${pair.timestamp || ''}`;
      imgB.addEventListener('click', () => {
        window.openComparePreviewModal(
          pair.imageA,
          pair.imageB,
          `Compare • ${pair.timestamp || ''}`,
          'URL A',
          'URL B'
        );
      });
      colB.appendChild(titleB);
      colB.appendChild(imgB);

      row.appendChild(colA);
      row.appendChild(colB);
      card.appendChild(label);
      card.appendChild(row);
      grid.appendChild(card);
    });

    grid.style.display = 'grid';
  }

  function setupPreviewModal() {
    const modal = document.getElementById('previewModal');
    const backdrop = document.getElementById('previewBackdrop');
    const closeBtn = document.getElementById('previewClose');
    const zoomInBtn = document.getElementById('previewZoomIn');
    const zoomOutBtn = document.getElementById('previewZoomOut');
    const zoomResetBtn = document.getElementById('previewZoomReset');
    const previewImageA = document.getElementById('previewImageA');
    const previewImageB = document.getElementById('previewImageB');
    const previewSlotB = document.getElementById('previewSlotB');
    const previewLabelA = document.getElementById('previewLabelA');
    const previewLabelB = document.getElementById('previewLabelB');
    const previewTitle = document.getElementById('previewTitle');

    if (!modal || !backdrop || !closeBtn || !zoomInBtn || !zoomOutBtn || !zoomResetBtn || !previewImageA || !previewImageB || !previewSlotB || !previewLabelA || !previewLabelB || !previewTitle) {
      return;
    }

    let zoom = 1;
    const ZOOM_MIN = 0.1;
    const ZOOM_MAX = 8;
    const ZOOM_STEP = 0.2;

    function applyZoom() {
      previewImageA.style.transform = `scale(${zoom})`;
      previewImageB.style.transform = `scale(${zoom})`;
      zoomResetBtn.textContent = `${Math.round(zoom * 100)}%`;
    }

    function closeModal() {
      modal.style.display = 'none';
      previewImageA.src = '';
      previewImageB.src = '';
    }

    function openSingleModal(src, title) {
      previewImageA.src = src;
      previewLabelA.textContent = 'Image';
      previewSlotB.style.display = 'none';
      previewImageB.src = '';
      previewTitle.textContent = title || 'Image Preview';
      zoom = 1;
      applyZoom();
      modal.style.display = 'block';
    }

    function openCompareModal(srcA, srcB, title, labelA = 'Image A', labelB = 'Image B') {
      previewImageA.src = srcA;
      previewImageB.src = srcB;
      previewLabelA.textContent = labelA;
      previewLabelB.textContent = labelB;
      previewSlotB.style.display = 'block';
      previewTitle.textContent = title || 'Image Compare Preview';
      zoom = 1;
      applyZoom();
      modal.style.display = 'block';
    }

    zoomInBtn.addEventListener('click', () => {
      zoom = Math.min(ZOOM_MAX, zoom + ZOOM_STEP);
      applyZoom();
    });

    zoomOutBtn.addEventListener('click', () => {
      zoom = Math.max(ZOOM_MIN, zoom - ZOOM_STEP);
      applyZoom();
    });

    zoomResetBtn.addEventListener('click', () => {
      zoom = 1;
      applyZoom();
    });

    backdrop.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.style.display === 'block') {
        closeModal();
      }
    });

    window.openPreviewModal = openSingleModal;
    window.openComparePreviewModal = openCompareModal;
  }

  function init() {
    const client = new MediaInfoAPIClient();

    const urlInput = document.getElementById('urlInput');
    const thumbCountInput = document.getElementById('thumbCountInput');
    const compareUrlA = document.getElementById('compareUrlA');
    const compareUrlB = document.getElementById('compareUrlB');
    const compareCountInput = document.getElementById('compareCountInput');
    const analyzeUrlBtn = document.getElementById('analyzeUrlBtn');
    const thumbUrlBtn = document.getElementById('thumbUrlBtn');
    const compareBtn = document.getElementById('compareBtn');
    const fileInput = document.getElementById('fileInput');
    const analyzeFileBtn = document.getElementById('analyzeFileBtn');

    setupTabs();
    setupThemeToggle();
    setupCopyButton();
    setupFormatButtons(client);
    setupPreviewModal();

    if (analyzeUrlBtn && urlInput) {
      analyzeUrlBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        renderThumbnails([]);
        setButtonLoading(analyzeUrlBtn, true, 'Analyze URL');
        try {
          await client.analyzeFromUrl(url);
        } catch (_error) {
          // handled by client
        } finally {
          setButtonLoading(analyzeUrlBtn, false, 'Analyze URL');
        }
      });

      urlInput.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        analyzeUrlBtn.click();
      });
    }

    if (thumbUrlBtn && urlInput) {
      thumbUrlBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        const thumbCount = thumbCountInput ? thumbCountInput.value : 5;
        renderComparePairs([]);
        setButtonLoading(thumbUrlBtn, true, 'Thumbnails');
        try {
          const thumbnails = await client.generateThumbnailsFromUrl(url, thumbCount);
          renderThumbnails(thumbnails);
          client.updateStatus('Thumbnails generated!', 'success');
        } catch (_error) {
          renderThumbnails([]);
        } finally {
          setButtonLoading(thumbUrlBtn, false, 'Thumbnails');
        }
      });
    }

    if (compareBtn && compareUrlA && compareUrlB) {
      compareBtn.addEventListener('click', async () => {
        const urlA = compareUrlA.value.trim();
        const urlB = compareUrlB.value.trim();
        const pairCount = compareCountInput ? compareCountInput.value : 4;
        renderThumbnails([]);
        setButtonLoading(compareBtn, true, 'Compare SS');
        try {
          const pairs = await client.compareThumbnailPairs(urlA, urlB, pairCount);
          renderComparePairs(pairs);
          client.updateStatus('Comparison generated!', 'success');
        } catch (_error) {
          renderComparePairs([]);
        } finally {
          setButtonLoading(compareBtn, false, 'Compare SS');
        }
      });
    }

    if (analyzeFileBtn && fileInput) {
      analyzeFileBtn.addEventListener('click', async () => {
        const file = fileInput.files && fileInput.files[0];
        setButtonLoading(analyzeFileBtn, true, 'Upload & Analyze');
        try {
          await client.analyzeFromFile(file);
        } catch (_error) {
          // handled by client
        } finally {
          setButtonLoading(analyzeFileBtn, false, 'Upload & Analyze');
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
