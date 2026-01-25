import React, { useState, useEffect } from 'react';
import { IconButton } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import ArticleIcon from '@mui/icons-material/Article';
import * as pdfjs from 'pdfjs-dist';
import {
  isPdfType,
  isImageType,
  isHtmlType,
  isRtfType,
  isTextType,
  base64ToDataUrl,
  base64ToUint8Array,
  formatFileSize,
  formatDocumentDate
} from './lib/documentUtils.js';
import { downloadDocument } from './lib/saveDiv.js';
import styles from './DocumentList.module.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// +---------------+
// | DocumentCard  |
// +---------------+

function DocumentCard({ document, onView }) {
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const generateThumbnail = async () => {
      try {
        if (isPdfType(document.contentType)) {
          // Generate PDF thumbnail
          const pdfData = base64ToUint8Array(document.base64Data);
          const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
          const page = await pdf.getPage(1);

          const scale = 0.5;
          const viewport = page.getViewport({ scale });

          const canvas = window.document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;

          if (!cancelled) {
            setThumbnail(canvas.toDataURL('image/jpeg', 0.7));
            setLoading(false);
          }

          pdf.destroy();
        } else if (isImageType(document.contentType)) {
          // Use image directly as thumbnail
          if (!cancelled) {
            setThumbnail(base64ToDataUrl(document.base64Data, document.contentType));
            setLoading(false);
          }
        } else {
          if (!cancelled) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error generating thumbnail:', err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    generateThumbnail();

    return () => {
      cancelled = true;
    };
  }, [document]);

  const handleDownload = (e) => {
    e.stopPropagation();
    downloadDocument(document);
  };

  const handleView = (e) => {
    e.stopPropagation();
    onView();
  };

  const getTypeInfo = () => {
    if (isPdfType(document.contentType)) {
      return { label: 'PDF', cssClass: 'pdf', Icon: PictureAsPdfIcon };
    }
    if (isHtmlType(document.contentType)) {
      return { label: 'Note', cssClass: 'note', Icon: DescriptionIcon };
    }
    if (isRtfType(document.contentType)) {
      return { label: 'Note', cssClass: 'note', Icon: ArticleIcon };
    }
    if (isTextType(document.contentType)) {
      return { label: 'Text', cssClass: 'text', Icon: DescriptionIcon };
    }
    if (isImageType(document.contentType)) {
      return { label: 'Image', cssClass: 'image', Icon: ImageIcon };
    }
    return { label: 'Doc', cssClass: 'document', Icon: DescriptionIcon };
  };

  const typeInfo = getTypeInfo();

  const renderThumbnail = () => {
    if (loading) {
      return (
        <div className={`${styles.thumbnailPlaceholder} ${styles[typeInfo.cssClass]}`}>
          <div className={styles.loadingSpinner} />
        </div>
      );
    }

    if (error || !thumbnail) {
      const IconComponent = typeInfo.Icon;
      return (
        <div className={`${styles.thumbnailPlaceholder} ${styles[typeInfo.cssClass]}`}>
          <IconComponent className={`${styles.placeholderIcon} ${styles[typeInfo.cssClass]}`} />
        </div>
      );
    }

    return (
      <img
        src={thumbnail}
        alt={document.title}
        className={styles.thumbnail}
      />
    );
  };

  return (
    <div className={styles.card} onClick={handleView}>
      <div className={styles.thumbnailContainer}>
        {renderThumbnail()}
      </div>
      <div className={styles.cardContent}>
        <div className={styles.title} title={document.title}>
          {document.title}
        </div>
        <div className={styles.meta}>
          {document.date && (
            <span className={styles.date}>{formatDocumentDate(document.date)}</span>
          )}
          <span className={styles.size}>{formatFileSize(document.sizeBytes)}</span>
        </div>
        {document.category && (
          <div className={styles.category}>{document.category}</div>
        )}
      </div>
      <div className={styles.actions} data-html2canvas-ignore="true">
        <IconButton
          size="small"
          onClick={handleView}
          className={styles.iconButton}
          title="View"
        >
          <VisibilityIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={handleDownload}
          className={styles.iconButton}
          title="Download"
        >
          <DownloadIcon fontSize="small" />
        </IconButton>
      </div>
    </div>
  );
}

// +---------------+
// | DocumentList  |
// +---------------+

export default function DocumentList({ documents, onViewDocument }) {
  if (!documents || documents.length === 0) {
    return (
      <div className={styles.emptyState}>
        No documents available
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onView={() => onViewDocument(doc)}
        />
      ))}
    </div>
  );
}
