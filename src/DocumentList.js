import React, { useState, useEffect } from 'react';
import { IconButton } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import ArticleIcon from '@mui/icons-material/Article';
import {
  isPdfType,
  isImageType,
  isHtmlType,
  isRtfType,
  isTextType,
  base64ToDataUrl,
  formatFileSize
} from './lib/documentUtils.js';
import { renderDate } from './lib/fhirUtil.js';
import { downloadDocument } from './lib/saveDiv.js';
import { useLanguage } from './lib/LanguageContext';
import styles from './DocumentList.module.css';

// +---------------+
// | DocumentCard  |
// +---------------+

function DocumentCard({ document, onView }) {
  const { t } = useLanguage();
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const generateThumbnail = async () => {
      if (document.isExternal) {
        setLoading(false);
        return;
      }

      try {
        if (isImageType(document.contentType)) {
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
    if (document.isExternal) {
      return (
        <div className={`${styles.thumbnailPlaceholder} ${styles.external}`}>
          <VisibilityOffIcon className={`${styles.placeholderIcon} ${styles.external}`} />
        </div>
      );
    }

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
    <div className={`${styles.card} ${document.isExternal ? styles.externalCard : ''}`} onClick={document.isExternal ? undefined : handleView}>
      <div className={styles.thumbnailContainer}>
        {renderThumbnail()}
      </div>
      <div className={styles.cardContent}>
        <div className={styles.title} title={document.title}>
          {document.title}
        </div>
        {document.isExternal ? (
          <div className={styles.externalMessage}>
            {t('externalDocumentMessage', 'This data could not be displayed because of a technical formatting issue from the EHR, not an issue with your records.')}
          </div>
        ) : (
          <>
            <div className={styles.meta}>
              {document.rawDate && (
                <span className={styles.date}>{renderDate(document.rawDate)}</span>
              )}
              <span className={styles.size}>{formatFileSize(document.sizeBytes)}</span>
            </div>
            {document.category && (
              <div className={styles.category}>{document.category}</div>
            )}
          </>
        )}
      </div>
      <div className={styles.actions} data-html2canvas-ignore="true">
        <IconButton
          size="small"
          onClick={handleView}
          className={styles.iconButton}
          title="View"
          disabled={document.isExternal}
        >
          <VisibilityIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={handleDownload}
          className={styles.iconButton}
          title="Download"
          disabled={document.isExternal}
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
