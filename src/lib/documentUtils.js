
//
// Utilities for extracting and handling embedded documents from FHIR bundles.
// Supports DocumentReference and DiagnosticReport resources with base64-encoded attachments.
//

// Global counter for generating unique document IDs
// eslint-disable-next-line no-unused-vars
let documentIdCounter = 0;

// +------------------+
// | MIME Type Checks |
// +------------------+

export function isPdfType(contentType) {
  // Handle contentType with parameters (e.g., "application/pdf; charset=utf-8")
  const mimeType = contentType?.split(';')[0]?.trim()?.toLowerCase();
  return mimeType === 'application/pdf';
}

export function isImageType(contentType) {
  const mimeType = contentType?.split(';')[0]?.trim()?.toLowerCase();
  return mimeType?.startsWith('image/');
}

export function isHtmlType(contentType) {
  const mimeType = contentType?.split(';')[0]?.trim()?.toLowerCase();
  return mimeType === 'text/html';
}

export function isRtfType(contentType) {
  const mimeType = contentType?.split(';')[0]?.trim()?.toLowerCase();
  return mimeType === 'text/rtf' || mimeType === 'application/rtf';
}

export function isTextType(contentType) {
  const mimeType = contentType?.split(';')[0]?.trim()?.toLowerCase();
  return mimeType === 'text/plain';
}

export function isSupportedType(contentType) {
  const mimeType = contentType?.split(';')[0]?.trim()?.toLowerCase();
  return mimeType === 'application/pdf' ||
         mimeType === 'image/jpeg' ||
         mimeType === 'image/png' ||
         mimeType === 'image/gif' ||
         mimeType === 'text/html' ||
         mimeType === 'text/rtf' ||
         mimeType === 'application/rtf' ||
         mimeType === 'text/plain';
}

// +--------------------+
// | Document Extraction |
// +--------------------+

/**
 * Extract all embedded documents from an organized bundle.
 * @param {Object} organized - The organized bundle from resources.js
 * @returns {Array} Array of ExtractedDocument objects
 */
export function extractDocumentsFromBundle(organized) {
  const documents = [];

  // Reset counter for each bundle extraction to ensure consistent IDs
  documentIdCounter = 0;

  // Extract from DocumentReference resources
  const docRefs = organized?.byType?.DocumentReference || [];
  for (let docIdx = 0; docIdx < docRefs.length; docIdx++) {
    const extracted = extractFromDocumentReference(docRefs[docIdx], docIdx);
    documents.push(...extracted);
  }

  // Extract from DiagnosticReport resources (presentedForm)
  const diagReports = organized?.byType?.DiagnosticReport || [];
  for (let reportIdx = 0; reportIdx < diagReports.length; reportIdx++) {
    const extracted = extractFromDiagnosticReport(diagReports[reportIdx], reportIdx);
    documents.push(...extracted);
  }

  // Sort by date (most recent first)
  documents.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date - a.date;
  });

  return documents;
}

/**
 * Extract documents from a DocumentReference resource.
 * @param {Object} docRef - FHIR DocumentReference resource
 * @param {number} resourceIndex - Index of this resource in the array
 * @returns {Array} Array of ExtractedDocument objects
 */
export function extractFromDocumentReference(docRef, resourceIndex = 0) {
  const documents = [];

  if (!docRef?.content) return documents;

  const contents = Array.isArray(docRef.content) ? docRef.content : [docRef.content];

  for (let i = 0; i < contents.length; i++) {
    const content = contents[i];
    const attachment = content?.attachment;

    if (!attachment?.data) continue;
    if (!isSupportedType(attachment.contentType)) continue;

    const uniqueId = documentIdCounter++;
    documents.push({
      id: `docref-${uniqueId}-${docRef.id || resourceIndex}-${i}`,
      resourceType: 'DocumentReference',
      resourceId: docRef.id,
      title: getDocumentTitle(docRef, attachment, i),
      contentType: attachment.contentType,
      base64Data: attachment.data,
      date: parseDocumentDate(docRef.date || docRef.created),
      status: docRef.status || 'current',
      description: docRef.description || attachment.title || '',
      category: getDocumentCategory(docRef),
      sizeBytes: estimateBase64Size(attachment.data)
    });
  }

  return documents;
}

/**
 * Extract documents from a DiagnosticReport resource.
 * @param {Object} diagReport - FHIR DiagnosticReport resource
 * @param {number} resourceIndex - Index of this resource in the array
 * @returns {Array} Array of ExtractedDocument objects
 */
export function extractFromDiagnosticReport(diagReport, resourceIndex = 0) {
  const documents = [];

  if (!diagReport?.presentedForm) return documents;

  const forms = Array.isArray(diagReport.presentedForm)
    ? diagReport.presentedForm
    : [diagReport.presentedForm];

  for (let i = 0; i < forms.length; i++) {
    const attachment = forms[i];

    if (!attachment?.data) continue;
    if (!isSupportedType(attachment.contentType)) continue;

    const uniqueId = documentIdCounter++;
    documents.push({
      id: `diagreport-${uniqueId}-${diagReport.id || resourceIndex}-${i}`,
      resourceType: 'DiagnosticReport',
      resourceId: diagReport.id,
      title: getDiagnosticReportTitle(diagReport, attachment, i),
      contentType: attachment.contentType,
      base64Data: attachment.data,
      date: parseDocumentDate(diagReport.effectiveDateTime || diagReport.issued),
      status: diagReport.status || 'final',
      description: attachment.title || diagReport.conclusion || '',
      category: getDiagnosticReportCategory(diagReport),
      sizeBytes: estimateBase64Size(attachment.data)
    });
  }

  return documents;
}

// +-------------------+
// | Title Extraction  |
// +-------------------+

function getDocumentTitle(docRef, attachment, index) {
  // Try various sources for the title
  if (attachment?.title) return attachment.title;
  if (docRef.description) return docRef.description;
  if (docRef.type?.text) return docRef.type.text;
  if (docRef.type?.coding?.[0]?.display) return docRef.type.coding[0].display;
  if (docRef.category?.[0]?.text) return docRef.category[0].text;
  if (docRef.category?.[0]?.coding?.[0]?.display) return docRef.category[0].coding[0].display;

  return `Document ${index + 1}`;
}

function getDiagnosticReportTitle(diagReport, attachment, index) {
  if (attachment?.title) return attachment.title;
  if (diagReport.code?.text) return diagReport.code.text;
  if (diagReport.code?.coding?.[0]?.display) return diagReport.code.coding[0].display;
  if (diagReport.category?.[0]?.text) return diagReport.category[0].text;

  return `Report ${index + 1}`;
}

// +---------------------+
// | Category Extraction |
// +---------------------+

function getDocumentCategory(docRef) {
  if (docRef.category?.[0]?.text) return docRef.category[0].text;
  if (docRef.category?.[0]?.coding?.[0]?.display) return docRef.category[0].coding[0].display;
  if (docRef.type?.text) return docRef.type.text;
  if (docRef.type?.coding?.[0]?.display) return docRef.type.coding[0].display;
  return 'Document';
}

function getDiagnosticReportCategory(diagReport) {
  if (diagReport.category?.[0]?.text) return diagReport.category[0].text;
  if (diagReport.category?.[0]?.coding?.[0]?.display) return diagReport.category[0].coding[0].display;
  return 'Diagnostic Report';
}

// +-------------------+
// | Date Parsing      |
// +-------------------+

function parseDocumentDate(dateString) {
  if (!dateString) return null;
  try {
    return new Date(dateString);
  } catch {
    return null;
  }
}

// +-------------------+
// | Size Estimation   |
// +-------------------+

function estimateBase64Size(base64Data) {
  if (!base64Data) return 0;
  // Base64 encoding adds ~33% overhead, so actual size is ~75% of base64 length
  return Math.floor(base64Data.length * 0.75);
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// +-------------------+
// | Data Conversion   |
// +-------------------+

/**
 * Convert base64 data to a data URL for display.
 * @param {string} base64Data - The base64 encoded data
 * @param {string} contentType - The MIME type
 * @returns {string} Data URL
 */
export function base64ToDataUrl(base64Data, contentType) {
  return `data:${contentType};base64,${base64Data}`;
}

/**
 * Convert base64 data to a Blob for download.
 * @param {string} base64Data - The base64 encoded data
 * @param {string} contentType - The MIME type
 * @returns {Blob} Binary blob
 */
export function base64ToBlob(base64Data, contentType) {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

/**
 * Convert base64 data to Uint8Array for PDF.js.
 * @param {string} base64Data - The base64 encoded data
 * @returns {Uint8Array} Binary array
 */
export function base64ToUint8Array(base64Data) {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// +-------------------+
// | File Extension    |
// +-------------------+

export function getExtensionFromMimeType(mimeType) {
  const baseMime = mimeType?.split(';')[0]?.trim()?.toLowerCase();
  const extensions = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'text/html': 'html',
    'text/rtf': 'rtf',
    'application/rtf': 'rtf',
    'text/plain': 'txt'
  };
  return extensions[baseMime] || 'bin';
}

// +-------------------+
// | Date Formatting   |
// +-------------------+

export function formatDocumentDate(date) {
  if (!date) return '';
  try {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '';
  }
}

