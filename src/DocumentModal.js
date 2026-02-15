import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button,
  Typography,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import * as pdfjs from 'pdfjs-dist';
import {
  isPdfType,
  isImageType,
  isHtmlType,
  isRtfType,
  isTextType,
  base64ToDataUrl
} from './lib/documentUtils.js';
import { b64_to_arr } from './lib/b64.js';
import { downloadDocument } from './lib/saveDiv.js';
import styles from './DocumentModal.module.css';
import DOMPurify from 'dompurify';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function DocumentModal({
  document,
  open,
  onClose,
  documents,
  onNavigate
}) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rtfHtml, setRtfHtml] = useState(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Get current document index for navigation
  const currentIndex = documents?.findIndex(d => d.id === document?.id) ?? -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < (documents?.length ?? 0) - 1;

  // Load PDF document
  useEffect(() => {
    if (!document || !open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setRtfHtml(null);

    const loadDocument = async () => {
      try {
        if (isPdfType(document.contentType)) {
          const pdfData = b64_to_arr(document.base64Data);
          const pdf = await pdfjs.getDocument({ data: pdfData }).promise;

          if (!cancelled) {
            setPdfDoc(pdf);
            setTotalPages(pdf.numPages);
            setCurrentPage(1);
            setScale(1.0);
            setLoading(false);
          }
        } else if (isRtfType(document.contentType)) {
          const rtfString = atob(document.base64Data);
          const buffer = new ArrayBuffer(rtfString.length);
          const view = new Uint8Array(buffer);
          for (let i = 0; i < rtfString.length; i++) {
            view[i] = rtfString.charCodeAt(i);
          }

          // Dynamically import rtf.js (~965KB) to keep it out of the main bundle.
          // Most SHL payloads don't contain RTF, so we only load it when needed.
          const { RTFJS } = await import('rtf.js');
          RTFJS.loggingEnabled(false);
          const rtfDoc = new RTFJS.Document(buffer);
          const elements = await rtfDoc.render();

          const container = window.document.createElement('div');
          elements.forEach(el => container.appendChild(el));

          // Strip all links from RTF - they are EHR-internal and inaccessible to the viewer
          container.querySelectorAll('a[href]').forEach(a => {
            a.removeAttribute('href');
          });

          const html = DOMPurify.sanitize(container.innerHTML, {
            ADD_TAGS: ['style'],
            ADD_ATTR: ['style', 'class']
          });

          if (!cancelled) {
            setPdfDoc(null);
            setRtfHtml(html);
            setLoading(false);
          }
        } else {
          if (!cancelled) {
            setPdfDoc(null);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error loading document:', err);
        if (!cancelled) {
          setError('Failed to load document: ' + err.message);
          setLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      cancelled = true;
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, open]);

  // Render PDF page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    // Cancel any ongoing render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', err);
      }
    }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Cleanup on close
  useEffect(() => {
    if (!open && pdfDoc) {
      pdfDoc.destroy();
      setPdfDoc(null);
    }
  }, [open, pdfDoc]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        if (isPdfType(document?.contentType) && currentPage > 1) {
          setCurrentPage(p => p - 1);
        } else if (hasPrev) {
          onNavigate('prev');
        }
      } else if (e.key === 'ArrowRight') {
        if (isPdfType(document?.contentType) && currentPage < totalPages) {
          setCurrentPage(p => p + 1);
        } else if (hasNext) {
          onNavigate('next');
        }
      } else if (e.key === '+' || e.key === '=') {
        setScale(s => Math.min(s + 0.25, 3.0));
      } else if (e.key === '-') {
        setScale(s => Math.max(s - 0.25, 0.5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, document, currentPage, totalPages, hasPrev, hasNext, onClose, onNavigate]);

  const handleDownload = () => {
    if (document) {
      downloadDocument(document);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(p => p - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(p => p + 1);
    }
  };

  const handleZoomIn = () => {
    setScale(s => Math.min(s + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale(s => Math.max(s - 0.25, 0.5));
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className={styles.loadingContainer}>
          <CircularProgress />
          <Typography variant="body2" className={styles.loadingText}>
            Loading document...
          </Typography>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.errorContainer}>
          <ErrorOutlineIcon className={styles.errorIcon} />
          <Typography variant="body1" className={styles.errorText}>
            {error}
          </Typography>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
          >
            Download Instead
          </Button>
        </div>
      );
    }

    if (isPdfType(document?.contentType)) {
      return (
        <div className={styles.pdfContainer}>
          <canvas ref={canvasRef} className={styles.pdfCanvas} />
        </div>
      );
    }

    if (isImageType(document?.contentType)) {
      return (
        <div className={styles.imageContainer}>
          <img
            src={base64ToDataUrl(document.base64Data, document.contentType)}
            alt={document.title}
            className={styles.image}
            style={{ transform: `scale(${scale})` }}
          />
        </div>
      );
    }

    if (isHtmlType(document?.contentType)) {
      // Decode base64 HTML content
      let htmlContent;
      try {
        htmlContent = atob(document.base64Data);
      } catch (e) {
        console.error('Failed to decode HTML content:', e);
        return (
          <div className={styles.errorContainer}>
            <Typography variant="body1">
              Failed to decode HTML content
            </Typography>
          </div>
        );
      }

      // Sanitize HTML content and add base target for links
      const sanitizedHtml = '<base target="_blank">' + DOMPurify.sanitize(htmlContent, {
        ADD_TAGS: ['style'],
        ADD_ATTR: ['style', 'class']
      });

      return (
        <div className={styles.htmlContainer}>
          <iframe
            srcDoc={sanitizedHtml}
            title={document.title}
            className={styles.htmlIframe}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      );
    }

    if (isRtfType(document?.contentType) && rtfHtml) {
      const rtfSrcDoc = '<base target="_blank">' + rtfHtml;
      return (
        <div className={styles.htmlContainer}>
          <iframe
            srcDoc={rtfSrcDoc}
            title={document.title}
            className={styles.htmlIframe}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      );
    }

    if (isTextType(document?.contentType)) {
      // Decode plain text content
      let textContent;
      try {
        textContent = atob(document.base64Data);
      } catch (e) {
        console.error('Failed to decode text content:', e);
        return (
          <div className={styles.errorContainer}>
            <Typography variant="body1">
              Failed to decode text content
            </Typography>
          </div>
        );
      }

      return (
        <div className={styles.textContainer}>
          <pre className={styles.textContent}>{textContent}</pre>
        </div>
      );
    }

    return (
      <div className={styles.errorContainer}>
        <Typography variant="body1">
          Unsupported document type: {document?.contentType}
        </Typography>
      </div>
    );
  };

  if (!document) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        className: styles.dialogPaper
      }}
    >
      <DialogTitle className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <Typography variant="h6" className={styles.title}>
              {document.title}
            </Typography>
            {documents && documents.length > 1 && (
              <Typography variant="body2" className={styles.docCount}>
                {currentIndex + 1} of {documents.length}
              </Typography>
            )}
          </div>
          <div className={styles.headerActions}>
            {hasPrev && (
              <IconButton
                onClick={() => onNavigate('prev')}
                title="Previous document"
              >
                <NavigateBeforeIcon />
              </IconButton>
            )}
            {hasNext && (
              <IconButton
                onClick={() => onNavigate('next')}
                title="Next document"
              >
                <NavigateNextIcon />
              </IconButton>
            )}
            <IconButton onClick={handleDownload} title="Download">
              <DownloadIcon />
            </IconButton>
            <IconButton onClick={onClose} title="Close">
              <CloseIcon />
            </IconButton>
          </div>
        </div>
      </DialogTitle>

      <DialogContent className={styles.content}>
        {renderContent()}
      </DialogContent>

      {!loading && !error && (isPdfType(document.contentType) || isImageType(document.contentType)) && (
        <div className={styles.controls}>
          {isPdfType(document.contentType) && totalPages > 1 && (
            <div className={styles.pageControls}>
              <IconButton
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                size="small"
              >
                <NavigateBeforeIcon />
              </IconButton>
              <Typography variant="body2" className={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </Typography>
              <IconButton
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                size="small"
              >
                <NavigateNextIcon />
              </IconButton>
            </div>
          )}
          <div className={styles.zoomControls}>
            <IconButton onClick={handleZoomOut} size="small" title="Zoom out">
              <ZoomOutIcon />
            </IconButton>
            <Typography variant="body2" className={styles.zoomInfo}>
              {Math.round(scale * 100)}%
            </Typography>
            <IconButton onClick={handleZoomIn} size="small" title="Zoom in">
              <ZoomInIcon />
            </IconButton>
          </div>
        </div>
      )}
    </Dialog>
  );
}
