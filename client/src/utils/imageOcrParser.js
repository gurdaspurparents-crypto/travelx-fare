import Tesseract from 'tesseract.js';
import { api } from './api';

/**
 * Preprocess image on canvas to enhance contrast and readability for OCR
 */
async function preprocessImage(imageSource) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve(imageSource);
    }

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const url = typeof imageSource === 'string'
        ? imageSource
        : URL.createObjectURL(imageSource);

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          // Scale up small images for better OCR resolution
          const scale = Math.max(1, Math.min(2, 1600 / Math.max(img.width, img.height)));
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);

          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Contrast and grayscale filtering
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            // Increase contrast
            const contrast = 1.35;
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
            let c = factor * (gray - 128) + 128;
            c = c > 210 ? 255 : (c < 75 ? 0 : c);
            d[i] = c;
            d[i + 1] = c;
            d[i + 2] = c;
          }
          ctx.putImageData(imgData, 0, 0);

          canvas.toBlob((blob) => {
            if (typeof imageSource !== 'string') URL.revokeObjectURL(url);
            resolve(blob || imageSource);
          }, 'image/png');
        } catch (e) {
          if (typeof imageSource !== 'string') URL.revokeObjectURL(url);
          resolve(imageSource);
        }
      };

      img.onerror = () => {
        if (typeof imageSource !== 'string') URL.revokeObjectURL(url);
        resolve(imageSource);
      };

      img.src = url;
    } catch (err) {
      resolve(imageSource);
    }
  });
}

/**
 * Perform OCR on an image file (PNG, JPG, WEBP, or Blob from clipboard)
 * and parse airline special fare records using our smart text parser.
 * 
 * @param {File|Blob|string} imageFileOrBlob - The image file, blob, or data URL
 * @param {Object} defaults - Optional defaults: { defaultOrigin, defaultDestination, defaultAirline, defaultBaggage }
 * @param {Function} onProgress - Progress callback (percentage 0-100)
 */
export async function parseImageFares(imageFileOrBlob, defaults = {}, onProgress = null) {
  try {
    if (!imageFileOrBlob) {
      return { success: false, error: 'No image file provided.' };
    }

    if (onProgress) onProgress(5);

    // Preprocess image for maximum OCR contrast
    const processedBlob = await preprocessImage(imageFileOrBlob);

    if (onProgress) onProgress(15);

    // Run Tesseract OCR on the image
    const { data } = await Tesseract.recognize(processedBlob || imageFileOrBlob, 'eng', {
      logger: (m) => {
        if (onProgress && m.status === 'recognizing text' && m.progress !== undefined) {
          // Map 0 - 1 to 20 - 85%
          onProgress(20 + Math.round(m.progress * 65));
        }
      }
    });

    if (onProgress) onProgress(90);

    const rawText = (data?.text || '').trim();
    if (!rawText) {
      return { 
        success: false, 
        error: 'No readable text was found in this image. Please ensure the image has clear text and numbers.' 
      };
    }

    // Clean up typical OCR artifacts
    const cleanedText = rawText
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[|]/g, ' ')
      .replace(/₹/g, ' ')
      .replace(/Rs\.?/gi, ' ')
      .replace(/(^|[^a-zA-Z0-9])(?:INR|RS\.?|₹|[Xx¥$€])\s*(?=\d)/gi, '$1 ')
      .replace(/\s*->\s*|\s*–>\s*|\s*—>\s*|\s*→\s*|\s*➔\s*|\s*➜\s*/g, ' -> ')
      .replace(/\s*>\s*/g, ' -> ');

    // Use backend smart WhatsApp / text parser to extract routes, dates, airlines, fares
    const parsed = await api.parseWhatsApp(cleanedText, defaults);

    if (onProgress) onProgress(100);

    return {
      success: true,
      rawText,
      cleanedText,
      confidence: Math.round(data.confidence || 0),
      records: parsed.records || [],
      metadata: parsed.metadata || {},
      parsed
    };
  } catch (err) {
    console.error('Error parsing image:', err);
    return {
      success: false,
      error: err.message || 'Failed to process image OCR.'
    };
  }
}
