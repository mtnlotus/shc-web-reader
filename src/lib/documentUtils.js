
//
// Utilities for extracting and handling embedded documents from FHIR bundles.
// Supports DocumentReference and DiagnosticReport resources with base64-encoded attachments.
//

import { parseDateTime } from './fhirUtil.js';
import { b64_to_arr } from './b64.js';

// +------------------+
// | MIME Type Checks |
// +------------------+

function normalizeMimeType(contentType) {
  return contentType?.split(';')[0]?.trim()?.toLowerCase();
}

export function isPdfType(contentType) {
  return normalizeMimeType(contentType) === 'application/pdf';
}

export function isImageType(contentType) {
  return normalizeMimeType(contentType)?.startsWith('image/');
}

export function isHtmlType(contentType) {
  return normalizeMimeType(contentType) === 'text/html';
}

export function isRtfType(contentType) {
  const mimeType = normalizeMimeType(contentType);
  return mimeType === 'text/rtf' || mimeType === 'application/rtf';
}

export function isTextType(contentType) {
  return normalizeMimeType(contentType) === 'text/plain';
}

export function isSupportedType(contentType) {
  return isPdfType(contentType) ||
         isImageType(contentType) ||
         isHtmlType(contentType) ||
         isRtfType(contentType) ||
         isTextType(contentType);
}

// +--------------------+
// | Document Extraction |
// +--------------------+

/**
 * Extract all embedded documents from an organized bundle.
 * @param {Object} organized - The organized bundle from resources.js
 * @returns {Array} Array of ExtractedDocument objects
 */
export function extractDocumentsFromBundle(organized, t) {
  const documents = [];

  // Extract from DocumentReference resources
  const docRefs = organized?.byType?.DocumentReference || [];
  for (let docIdx = 0; docIdx < docRefs.length; docIdx++) {
    const extracted = extractFromDocumentReference(docRefs[docIdx], docIdx, t);
    documents.push(...extracted);
  }

  // Extract from DiagnosticReport resources (presentedForm)
  const diagReports = organized?.byType?.DiagnosticReport || [];
  for (let reportIdx = 0; reportIdx < diagReports.length; reportIdx++) {
    const extracted = extractFromDiagnosticReport(diagReports[reportIdx], reportIdx, t);
    documents.push(...extracted);
  }

  // Sort by date (most recent first), then by title as secondary
  documents.sort((a, b) => {
    if (!a.date && !b.date) return (a.title || '').localeCompare(b.title || '');
    if (!a.date) return 1;
    if (!b.date) return -1;
    const dateDiff = b.date - a.date;
    if (dateDiff !== 0) return dateDiff;
    return (a.title || '').localeCompare(b.title || '');
  });

  return documents;
}

/**
 * Extract documents from a DocumentReference resource.
 * @param {Object} docRef - FHIR DocumentReference resource
 * @param {number} resourceIndex - Index of this resource in the array
 * @returns {Array} Array of ExtractedDocument objects
 */
export function extractFromDocumentReference(docRef, resourceIndex = 0, t) {
  const documents = [];

  if (!docRef?.content) return documents;

  const contents = Array.isArray(docRef.content) ? docRef.content : [docRef.content];

  for (let i = 0; i < contents.length; i++) {
    const content = contents[i];
    const attachment = content?.attachment;

    if (!attachment?.data && !attachment?.url) continue;

    const isExternal = !attachment.data && !!attachment.url;

    if (!isExternal && !isSupportedType(attachment.contentType)) continue;

    documents.push({
      id: `docref-${docRef.id || resourceIndex}-${i}`,
      resourceType: 'DocumentReference',
      resourceId: docRef.id,
      title: getDocumentTitle(docRef, attachment, i, t),
      contentType: attachment.contentType,
      base64Data: attachment.data || null,
      rawDate: docRef.date || docRef.created || null,
      date: parseFhirDate(docRef.date || docRef.created),
      status: docRef.status || 'current',
      description: docRef.description || attachment.title || '',
      category: getDocumentCategory(docRef, t),
      sizeBytes: isExternal ? 0 : estimateBase64Size(attachment.data),
      isExternal
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
export function extractFromDiagnosticReport(diagReport, resourceIndex = 0, t) {
  const documents = [];

  if (!diagReport?.presentedForm) return documents;

  const forms = Array.isArray(diagReport.presentedForm)
    ? diagReport.presentedForm
    : [diagReport.presentedForm];

  for (let i = 0; i < forms.length; i++) {
    const attachment = forms[i];

    if (!attachment?.data && !attachment?.url) continue;

    const isExternal = !attachment.data && !!attachment.url;

    if (!isExternal && !isSupportedType(attachment.contentType)) continue;

    documents.push({
      id: `diagreport-${diagReport.id || resourceIndex}-${i}`,
      resourceType: 'DiagnosticReport',
      resourceId: diagReport.id,
      title: getDiagnosticReportTitle(diagReport, attachment, i, t),
      contentType: attachment.contentType,
      base64Data: attachment.data || null,
      rawDate: diagReport.effectiveDateTime || diagReport.issued || null,
      date: parseFhirDate(diagReport.effectiveDateTime || diagReport.issued),
      status: diagReport.status || 'final',
      description: attachment.title || diagReport.conclusion || '',
      category: getDiagnosticReportCategory(diagReport, t),
      sizeBytes: isExternal ? 0 : estimateBase64Size(attachment.data),
      isExternal
    });
  }

  return documents;
}

// +-------------------+
// | Title Extraction  |
// +-------------------+

function getDocumentTitle(docRef, attachment, index, t) {
  // Try various sources for the title
  if (attachment?.title) return attachment.title;
  if (docRef.description) return docRef.description;
  if (docRef.type?.text) return docRef.type.text;
  if (docRef.type?.coding?.[0]?.display) return docRef.type.coding[0].display;
  if (docRef.category?.[0]?.text) return docRef.category[0].text;
  if (docRef.category?.[0]?.coding?.[0]?.display) return docRef.category[0].coding[0].display;

  return `${t('documentFallbackTitle', 'Document')} ${index + 1}`;
}

function getDiagnosticReportTitle(diagReport, attachment, index, t) {
  if (attachment?.title) return attachment.title;
  if (diagReport.code?.text) return diagReport.code.text;
  if (diagReport.code?.coding?.[0]?.display) return diagReport.code.coding[0].display;
  if (diagReport.category?.[0]?.text) return diagReport.category[0].text;

  return `${t('reportFallbackTitle', 'Report')} ${index + 1}`;
}

// +---------------------+
// | Category Extraction |
// +---------------------+

function getDocumentCategory(docRef, t) {
  if (docRef.category?.[0]?.text) return docRef.category[0].text;
  if (docRef.category?.[0]?.coding?.[0]?.display) return docRef.category[0].coding[0].display;
  if (docRef.type?.text) return docRef.type.text;
  if (docRef.type?.coding?.[0]?.display) return docRef.type.coding[0].display;
  return t('documentCategory', 'Document');
}

function getDiagnosticReportCategory(diagReport, t) {
  if (diagReport.category?.[0]?.text) return diagReport.category[0].text;
  if (diagReport.category?.[0]?.coding?.[0]?.display) return diagReport.category[0].coding[0].display;
  return t('diagnosticReportCategory', 'Diagnostic Report');
}

// +-------------------+
// | Date Parsing      |
// +-------------------+

function parseFhirDate(dateString) {
  if (!dateString) return null;
  try {
    return parseDateTime(dateString);
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
  // parseFloat strips trailing zeros from toFixed output (e.g., "1.0" -> 1, "2.5" -> 2.5)
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
  return new Blob([b64_to_arr(base64Data)], { type: contentType });
}

// +-------------------+
// | File Extension    |
// +-------------------+

export function getExtensionFromMimeType(mimeType) {
  const baseMime = normalizeMimeType(mimeType);
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



