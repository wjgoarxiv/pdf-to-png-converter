// PDF to PNG Converter App
class PDFConverter {    constructor() {
        this.pdfDoc = null;
        this.convertedPages = new Map();
        this.selectedPages = new Set();
        this.isProcessing = false;
        this.currentDPI = 144; // Default to 144 DPI (2x scale)
        
        this.downloadQueue = [];
        this.isDownloading = false;
        
        this.initializeEventListeners();
        this.setupPDFJS();
        this.setupDPIControl();
    }

    setupPDFJS() {
        // Set PDF.js worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }    setupDPIControl() {
        const dpiSlider = document.getElementById('dpiSlider');
        const dpiValue = document.getElementById('dpiValue');
        const dpiActual = document.getElementById('dpiActual');
        
        dpiSlider.addEventListener('input', (e) => {
            this.currentDPI = parseInt(e.target.value);
            this.updateDPIDisplay();
            this.updatePresetButtons();
        });

        // Initialize display
        this.updateDPIDisplay();
        this.updatePresetButtons();
    }

    updateDPIDisplay() {
        const dpiValue = document.getElementById('dpiValue');
        const dpiActual = document.getElementById('dpiActual');
        const scaleFactor = (this.currentDPI / 72).toFixed(1);
        
        dpiValue.querySelector('div:first-child').textContent = scaleFactor + 'x';
        dpiActual.textContent = this.currentDPI + ' DPI';
    }

    updatePresetButtons() {
        const presetButtons = document.querySelectorAll('.dpi-preset-btn');
        presetButtons.forEach(btn => {
            btn.classList.remove('active');
            const btnDPI = parseInt(btn.textContent.match(/\d+/)[0]);
            if (btnDPI === this.currentDPI) {
                btn.classList.add('active');
            }
        });
    }

    setDPI(dpi) {
        this.currentDPI = dpi;
        document.getElementById('dpiSlider').value = dpi;
        this.updateDPIDisplay();
        this.updatePresetButtons();
    }

    initializeEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const uploadSection = document.getElementById('uploadSection');

        // File input change event
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });        // Drag and drop events
        uploadSection.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadSection.classList.add('dragover');
        });

        uploadSection.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadSection.classList.remove('dragover');
        });

        uploadSection.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadSection.classList.remove('dragover');
            
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type === 'application/pdf') {
                    this.handleFileSelect(file);
                } else {
                    alert('PDF 파일만 업로드 가능해요.');
                }
            }
        });
    }async handleFileSelect(file) {
        if (this.isProcessing) {
            alert('현재 작업이 완료될 때까지 잠시만 기다려주세요.');
            return;
        }

        try {
            this.isProcessing = true;
            this.showProgress('PDF 불러오는 중...');
            
            const arrayBuffer = await file.arrayBuffer();
            this.pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            this.displayPDFInfo(file.name, file.size, this.pdfDoc.numPages);
            this.showDPIControl();
            await this.convertAllPages();
            
        } catch (error) {
            console.error('PDF 처리 오류:', error);
            alert('PDF 파일을 처리하는 중 오류가 발생했어요. 올바른 PDF 파일인지 확인해주세요.');
        } finally {
            this.isProcessing = false;
            this.hideProgress();
        }
    }    displayPDFInfo(fileName, fileSize, totalPages) {
        document.getElementById('fileName').textContent = fileName;
        document.getElementById('totalPages').textContent = totalPages;
        document.getElementById('fileSize').textContent = this.formatFileSize(fileSize);
        document.getElementById('infoPanel').classList.add('show');
    }

    showDPIControl() {
        document.getElementById('dpiControl').classList.add('show');
    }    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showProgress(text) {
        const progressContainer = document.getElementById('progressContainer');
        const progressText = document.getElementById('progressText');
        const progressBar = document.getElementById('progressBar');
        
        progressContainer.style.display = 'block';
        progressText.textContent = text;
        progressBar.style.width = '0%';
    }

    updateProgress(current, total) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        const percentage = (current / total) * 100;
        progressBar.style.width = percentage + '%';
        progressText.textContent = `${current}/${total} 페이지 변환 중...`;
    }

    hideProgress() {
        document.getElementById('progressContainer').style.display = 'none';
    }    async convertAllPages() {
        const totalPages = this.pdfDoc.numPages;
        this.convertedPages.clear();
        
        this.showProgress('페이지 변환 중...');
        
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            this.updateProgress(pageNum, totalPages);
            
            try {
                const page = await this.pdfDoc.getPage(pageNum);
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                  // Use user-selected DPI scale
                const scale = this.currentDPI / 72; // Convert DPI to scale factor
                const viewport = page.getViewport({ scale });
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
                // Convert to PNG blob
                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/png', 1.0);
                });
                
                this.convertedPages.set(pageNum, {
                    blob: blob,
                    canvas: canvas,
                    fileName: `${pageNum}page.png`
                });
                
            } catch (error) {
                console.error(`${pageNum}페이지 변환 오류:`, error);
            }
        }
        
        this.hideProgress();
        this.showDownloadSection();
        this.createPageGrid();
    }

    showDownloadSection() {
        document.getElementById('downloadSection').classList.add('show');
    }

    createPageGrid() {
        const pagesGrid = document.getElementById('pagesGrid');
        pagesGrid.innerHTML = '';
        
        this.convertedPages.forEach((pageData, pageNum) => {
            const pageItem = document.createElement('div');
            pageItem.className = 'page-item';
            pageItem.dataset.pageNum = pageNum;
            
            // Create thumbnail
            const thumbnail = document.createElement('canvas');
            thumbnail.className = 'page-preview';
            const thumbCtx = thumbnail.getContext('2d');
            
            // Scale down for thumbnail
            const scale = 0.2;
            const sourceCanvas = pageData.canvas;
            thumbnail.width = sourceCanvas.width * scale;
            thumbnail.height = sourceCanvas.height * scale;
            
            thumbCtx.drawImage(sourceCanvas, 0, 0, thumbnail.width, thumbnail.height);
              const pageLabel = document.createElement('div');
            pageLabel.className = 'page-label';
            pageLabel.textContent = `${pageNum}페이지`;
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'btn-secondary';
            downloadBtn.textContent = '다운로드';
            downloadBtn.onclick = (e) => {
                e.stopPropagation();
                this.downloadSinglePage(pageNum);
            };
            
            pageItem.appendChild(thumbnail);
            pageItem.appendChild(pageLabel);
            pageItem.appendChild(downloadBtn);
            
            pageItem.onclick = () => this.togglePageSelection(pageNum);
            
            pagesGrid.appendChild(pageItem);
        });
    }

    togglePageSelection(pageNum) {
        const pageItem = document.querySelector(`[data-page-num="${pageNum}"]`);
        
        if (this.selectedPages.has(pageNum)) {
            this.selectedPages.delete(pageNum);
            pageItem.classList.remove('selected');
        } else {
            this.selectedPages.add(pageNum);
            pageItem.classList.add('selected');
        }
    }

    selectAllPages() {
        this.selectedPages.clear();
        this.convertedPages.forEach((_, pageNum) => {
            this.selectedPages.add(pageNum);
        });
        this.updatePageSelectionUI();
    }

    deselectAllPages() {
        this.selectedPages.clear();
        this.updatePageSelectionUI();
    }

    updatePageSelectionUI() {
        document.querySelectorAll('.page-item').forEach(item => {
            const pageNum = parseInt(item.dataset.pageNum);
            if (this.selectedPages.has(pageNum)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }    async downloadAllAsZip() {
        if (this.convertedPages.size === 0) {
            alert('다운로드할 페이지가 없어요. 먼저 PDF를 변환해주세요.');
            return;
        }

        this.showProgress('ZIP 파일 생성 중...');
        
        try {
            const zip = new JSZip();
            
            let current = 0;
            for (const [pageNum, pageData] of this.convertedPages) {
                current++;
                this.updateProgress(current, this.convertedPages.size);
                
                zip.file(pageData.fileName, pageData.blob);
            }
            
            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });
            
            this.downloadBlob(zipBlob, 'converted_pages.zip');
            
        } catch (error) {
            console.error('ZIP 파일 생성 오류:', error);
            alert('ZIP 파일을 만드는 중 오류가 발생했어요.');
        } finally {
            this.hideProgress();
        }
    }

    async downloadSelectedPages() {
        if (this.selectedPages.size === 0) {
            alert('다운로드할 페이지를 최소 1개 이상 선택해주세요.');
            return;
        }

        if (this.isDownloading) {
            alert('현재 다운로드가 진행 중입니다. 잠시만 기다려주세요.');
            return;
        }

        // If more than 10 pages selected, suggest ZIP download
        if (this.selectedPages.size > 10) {
            const useZip = confirm(`${this.selectedPages.size}개의 페이지를 선택하셨습니다.\n\n개별 다운로드는 브라우저 제한으로 인해 시간이 오래 걸릴 수 있습니다.\n\nZIP 파일로 한번에 다운로드하시겠습니까?\n\n확인: ZIP 다운로드\n취소: 개별 다운로드 (시간 소요)`);
            
            if (useZip) {
                await this.downloadSelectedAsZip();
                return;
            }
        }

        await this.downloadPagesSequentially();
    }

    async downloadSelectedAsZip() {
        if (this.selectedPages.size === 0) return;

        this.showProgress('선택된 페이지 ZIP 파일 생성 중...');
        
        try {
            const zip = new JSZip();
            
            let current = 0;
            for (const pageNum of this.selectedPages) {
                current++;
                this.updateProgress(current, this.selectedPages.size);
                
                const pageData = this.convertedPages.get(pageNum);
                if (pageData) {
                    zip.file(pageData.fileName, pageData.blob);
                }
            }
            
            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });
            
            this.downloadBlob(zipBlob, 'selected_pages.zip');
            
        } catch (error) {
            console.error('선택된 페이지 ZIP 파일 생성 오류:', error);
            alert('ZIP 파일을 만드는 중 오류가 발생했어요.');
        } finally {
            this.hideProgress();
        }
    }

    async downloadPagesSequentially() {
        this.isDownloading = true;
        const selectedArray = Array.from(this.selectedPages).sort((a, b) => a - b);
        
        this.showProgress('페이지 다운로드 중...');
        
        try {
            for (let i = 0; i < selectedArray.length; i++) {
                const pageNum = selectedArray[i];
                this.updateProgress(i + 1, selectedArray.length);
                
                const pageData = this.convertedPages.get(pageNum);
                if (pageData) {
                    this.downloadBlob(pageData.blob, pageData.fileName);
                    
                    // Add delay between downloads to avoid browser limits
                    if (i < selectedArray.length - 1) {
                        await this.delay(500); // 500ms delay between downloads
                    }
                }
            }
            
            // Show completion message
            setTimeout(() => {
                alert(`${selectedArray.length}개 페이지 다운로드가 완료되었습니다.`);
            }, 1000);
            
        } catch (error) {
            console.error('페이지 다운로드 오류:', error);
            alert('페이지 다운로드 중 오류가 발생했어요.');
        } finally {
            this.isDownloading = false;
            this.hideProgress();
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    downloadSinglePage(pageNum) {
        const pageData = this.convertedPages.get(pageNum);
        if (pageData) {
            this.downloadBlob(pageData.blob, pageData.fileName);
        }
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Global functions for HTML buttons
function setDPI(dpi) {
    window.pdfConverter.setDPI(dpi);
}

function downloadAllAsZip() {
    window.pdfConverter.downloadAllAsZip();
}

function showPageSelection() {
    const section = document.getElementById('pageSelectionSection');
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
}

function selectAllPages() {
    window.pdfConverter.selectAllPages();
}

function deselectAllPages() {
    window.pdfConverter.deselectAllPages();
}

function downloadSelectedPages() {
    window.pdfConverter.downloadSelectedPages();
}

// Initialize the app when the page loads
window.addEventListener('DOMContentLoaded', () => {
    window.pdfConverter = new PDFConverter();
});
