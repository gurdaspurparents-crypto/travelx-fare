import React, { useState, useEffect, useRef } from 'react';
import { 
  Image as ImageIcon, UploadCloud, Sparkles, Check, AlertCircle, 
  Trash2, RefreshCw, Eye, Edit3, ArrowRight, Layers, FileText, CheckCircle2,
  Bot, Key, ExternalLink, Copy, X, Settings, Plus
} from 'lucide-react';
import { parseImageFares } from '../utils/imageOcrParser';
import { api } from '../utils/api';

const POPULAR_AIRLINES = [
  { code: 'IX', name: 'Air India Express' },
  { code: '6E', name: 'IndiGo' },
  { code: 'AI', name: 'Air India' },
  { code: 'SG', name: 'SpiceJet' },
  { code: 'UK', name: 'Vistara' },
  { code: 'QP', name: 'Akasa Air' },
  { code: 'S5', name: 'Star Air' },
  { code: 'IC', name: 'Fly91' },
  { code: '9I', name: 'Alliance Air' },
  { code: 'EK', name: 'Emirates' },
  { code: 'FZ', name: 'flydubai' },
  { code: 'G9', name: 'Air Arabia' },
  { code: 'EY', name: 'Etihad Airways' },
  { code: 'QR', name: 'Qatar Airways' },
  { code: 'WY', name: 'Oman Air' },
  { code: 'OV', name: 'SalamAir' },
  { code: 'SV', name: 'Saudia' },
  { code: 'XY', name: 'Flynas' },
  { code: 'F3', name: 'Flyadeal' },
  { code: 'KU', name: 'Kuwait Airways' },
  { code: 'J9', name: 'Jazeera Airways' },
  { code: 'GF', name: 'Gulf Air' },
  { code: 'MS', name: 'EgyptAir' },
  { code: 'UL', name: 'SriLankan Airlines' },
  { code: 'BG', name: 'Biman Bangladesh' },
  { code: 'BS', name: 'US-Bangla Airlines' },
  { code: 'RA', name: 'Nepal Airlines' },
  { code: 'SQ', name: 'Singapore Airlines' },
  { code: 'MH', name: 'Malaysia Airlines' },
  { code: 'OD', name: 'Batik Air Malaysia' },
  { code: 'AK', name: 'AirAsia' },
  { code: 'TG', name: 'Thai Airways' },
  { code: 'SL', name: 'Thai Lion Air' },
  { code: 'VJ', name: 'VietJet Air' },
  { code: 'VN', name: 'Vietnam Airlines' },
  { code: 'CX', name: 'Cathay Pacific' },
  { code: 'BA', name: 'British Airways' },
  { code: 'VS', name: 'Virgin Atlantic' },
  { code: 'LH', name: 'Lufthansa' },
  { code: 'AF', name: 'Air France' },
  { code: 'KL', name: 'KLM Royal Dutch Airlines' },
  { code: 'TK', name: 'Turkish Airlines' },
  { code: 'AZ', name: 'ITA Airways' },
  { code: 'AC', name: 'Air Canada' },
  { code: 'UA', name: 'United Airlines' },
  { code: 'AA', name: 'American Airlines' },
  { code: 'DL', name: 'Delta Air Lines' }
];

export default function ImageOcrUploader({ 
  vendorName = 'Vendor', 
  vendorId, 
  masterData = {}, 
  onFaresSaved,
  setActiveTab 
}) {
  const { airlines = [], routes = [] } = masterData;

  // Combined Airline list with full names
  const combinedAirlines = [...airlines];
  for (const pop of POPULAR_AIRLINES) {
    if (!combinedAirlines.some(a => a.code?.toUpperCase() === pop.code)) {
      combinedAirlines.push(pop);
    }
  }

  const getAirlineDisplayName = (code) => {
    if (!code) return '';
    const match = combinedAirlines.find(a => a.code?.toUpperCase() === code?.toUpperCase());
    return match ? `${match.name} (${match.code})` : code;
  };

  // Sort helper: Route-wise first, then Airline-wise, then Date-wise
  const sortRecordsByRouteAndDate = (recordsList = []) => {
    return [...recordsList].sort((a, b) => {
      // 1. Route-wise (e.g. ATQ-DXB before ATQ-SHJ)
      const routeA = `${a.origin || ''}-${a.destination || ''}`;
      const routeB = `${b.origin || ''}-${b.destination || ''}`;
      if (routeA !== routeB) {
        return routeA.localeCompare(routeB);
      }
      // 2. Airline-wise
      const airA = a.airline_code || '';
      const airB = b.airline_code || '';
      if (airA !== airB) {
        return airA.localeCompare(airB);
      }
      // 3. Date-wise (chronological)
      const dateA = a.travel_date || '';
      const dateB = b.travel_date || '';
      return dateA.localeCompare(dateB);
    });
  };

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [batchStatus, setBatchStatus] = useState(null); // { current: 1, total: 3, currentName: 'flyer1.png' }
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState(null);
  const [extractError, setExtractError] = useState('');
  const [status, setStatus] = useState(null);
  const [isRawTextOpen, setIsRawTextOpen] = useState(false);
  const [rawTextEdit, setRawTextEdit] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoDeleteMissing, setAutoDeleteMissing] = useState(true);
  const [saveFeedback, setSaveFeedback] = useState(null);

  // AI Vision Engine & Key States
  const [selectedEngine, setSelectedEngine] = useState('gemini'); // Default to gemini (100% free)
  const [openAiKey, setOpenAiKey] = useState(() => localStorage.getItem('travelx_openai_api_key') || '');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('travelx_gemini_api_key') || '');
  const [tempOpenAiKey, setTempOpenAiKey] = useState('');
  const [tempGeminiKey, setTempGeminiKey] = useState('');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [copyHelperStatus, setCopyHelperStatus] = useState(false);

  // Defaults if image doesn't explicitly mention sector or airline
  const [defaultOrigin, setDefaultOrigin] = useState('ATQ');
  const [defaultDestination, setDefaultDestination] = useState('DXB');
  const [defaultAirline, setDefaultAirline] = useState('AI');
  const [defaultBaggage, setDefaultBaggage] = useState('30kg');
  const [defaultRefundable, setDefaultRefundable] = useState('NON_REFUNDABLE');
  const [appendMode, setAppendMode] = useState(true); // Auto-append & combine multiple screenshots
  const fileInputRef = useRef(null);
  const addMoreFileInputRef = useRef(null);

  // Auto-sort on load or when new records arrive
  useEffect(() => {
    if (scanResult && scanResult.records && scanResult.records.length > 0) {
      const sorted = sortRecordsByRouteAndDate(scanResult.records);
      const isDiff = sorted.some((r, i) => r !== scanResult.records[i]);
      if (isDiff) {
        setScanResult(prev => ({ ...prev, records: sorted }));
      }
    }
  }, [scanResult?.records?.length]);

  const handleSortByRouteAndDate = () => {
    if (!scanResult || !scanResult.records) return;
    const sorted = sortRecordsByRouteAndDate(scanResult.records);
    setScanResult(prev => ({ ...prev, records: sorted }));
    setStatus({
      type: 'success',
      text: '🔀 Fares successfully sorted Route-wise then Date-wise!'
    });
  };

  const handleSortByDateOnly = () => {
    if (!scanResult || !scanResult.records) return;
    const sorted = [...scanResult.records].sort((a, b) => (a.travel_date || '').localeCompare(b.travel_date || ''));
    setScanResult(prev => ({ ...prev, records: sorted }));
    setStatus({
      type: 'success',
      text: '📅 Fares sorted by Travel Date!'
    });
  };

  // Clipboard Paste Listener (Ctrl + V anywhere)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            pastedFiles.push(blob);
          }
        }
      }

      if (pastedFiles.length > 0) {
        // If we already have files or scan results, and appendMode is active -> append!
        const shouldAppend = appendMode && (uploadedFiles.length > 0 || (scanResult?.records?.length || 0) > 0);
        handleProcessFiles(pastedFiles, null, shouldAppend);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [uploadedFiles, appendMode, scanResult, defaultOrigin, defaultDestination, defaultAirline, defaultBaggage, defaultRefundable, selectedEngine, openAiKey, geminiKey]);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const compressImageForScan = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const maxW = 1600;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        fileToBase64(file).then(resolve).catch(() => resolve(''));
      };
      img.src = url;
    });
  };

  /**
   * Helper: Process a single file through the selected AI engine
   */
  const processSingleFile = async (file, engineToUse, defaults) => {
    if (engineToUse === 'openai') {
      const effectiveKey = openAiKey || localStorage.getItem('travelx_openai_api_key') || '';
      if (!effectiveKey) {
        throw new Error('KEY_REQUIRED_OPENAI');
      }
      const base64Data = await compressImageForScan(file);
      const result = await api.parseImageWithAI({
        imageBase64: base64Data,
        provider: 'openai',
        apiKey: effectiveKey,
        defaults
      });
      return result;
    } else if (engineToUse === 'gemini') {
      const effectiveKey = geminiKey || localStorage.getItem('travelx_gemini_api_key') || '';
      if (!effectiveKey) {
        throw new Error('KEY_REQUIRED_GEMINI');
      }
      const ocr = await parseImageFares(file, defaults).catch((err) => ({
        success: false,
        records: [],
        error: err?.message || 'Local OCR failed'
      }));
      if (ocr?.records?.length) {
        return { ...ocr, success: true, provider: ocr.provider || 'ocr' };
      }
      const base64Data = await compressImageForScan(file);
      const result = await api.parseImageWithAI({
        imageBase64: base64Data,
        provider: 'gemini',
        apiKey: effectiveKey,
        defaults
      });
      if (result?.success && Array.isArray(result.records) && result.records.length > 0) {
        return result;
      }
      return {
        success: false,
        records: [],
        error: `${result?.error || 'Gemini se rates nahi nikle.'}${ocr?.error ? ` Local OCR: ${ocr.error}` : ' Local OCR ne bhi dates nahi padhi.'}`
      };
    } else {
      // Local Browser OCR (Tesseract)
      const result = await parseImageFares(file, defaults);
      return result;
    }
  };

  /**
   * Main Queue / Batch Processor for One or Multiple Files
   * Supports both fresh scan and sequential append (pasting multiple flyers one after another)
   */
  const handleProcessFiles = async (files, forcedEngine = null, isAppend = false) => {
    const rawFilesList = Array.isArray(files) ? files : [files];
    const validFiles = rawFilesList.filter(f => f && (f.type?.startsWith('image/') || f instanceof Blob));
    if (validFiles.length === 0) return;

    if (scanning) {
      setStatus({
        type: 'info',
        text: 'Flyer scanning is already in progress. Please wait a moment.'
      });
      return;
    }

    const engineToUse = forcedEngine || selectedEngine;

    // Check API Keys before starting batch
    if (engineToUse === 'openai') {
      const effectiveKey = openAiKey || localStorage.getItem('travelx_openai_api_key') || '';
      if (!effectiveKey) {
        setIsKeyModalOpen(true);
        setStatus({
          type: 'info',
          text: '🔑 Please enter your OpenAI (ChatGPT) API Key to scan with GPT-4o Vision.'
        });
        return;
      }
    } else if (engineToUse === 'gemini') {
      const effectiveKey = geminiKey || localStorage.getItem('travelx_gemini_api_key') || '';
      if (!effectiveKey) {
        setIsKeyModalOpen(true);
        setStatus({
          type: 'info',
          text: '🔑 Please enter your Google Gemini API Key to scan with Gemini Vision.'
        });
        return;
      }
    }

    const prevCount = isAppend ? uploadedFiles.length : 0;

    // Generate preview URLs with clear labels
    const newPreviews = validFiles.map((f, i) => {
      const flyerNum = prevCount + i + 1;
      const isGenericName = !f.name || f.name === 'image.png' || f.name.startsWith('blob');
      const displayName = isGenericName ? `Screenshot #${flyerNum}` : f.name;
      const flyerId = `flyer_${Date.now()}_${flyerNum}_${Math.random().toString(36).slice(2, 6)}`;
      return {
        id: flyerId,
        file: f,
        name: displayName,
        label: `Flyer #${flyerNum}`,
        url: URL.createObjectURL(f)
      };
    });

    const combinedFiles = isAppend ? [...uploadedFiles, ...validFiles] : validFiles;
    const combinedPreviews = isAppend ? [...filePreviews, ...newPreviews] : newPreviews;

    setUploadedFiles(combinedFiles);
    setFilePreviews(combinedPreviews);
    setActivePreviewIndex(isAppend ? combinedPreviews.length - 1 : 0);
    setImageFile(validFiles[0]);
    setImagePreview(newPreviews[0].url);

    setScanning(true);
    setScanProgress(8);
    setStatus(null);
    setExtractError('');
    const progressTimer = setInterval(() => {
      setScanProgress((p) => (p < 88 ? p + 2 : p));
    }, 1200);

    const defaults = {
      defaultOrigin,
      defaultDestination,
      defaultAirline,
      defaultBaggage,
      defaultRefundable
    };

    const existingRecords = isAppend && scanResult?.records ? [...scanResult.records] : [];
    const newRecords = [];
    const allRawTexts = isAppend && scanResult?.rawText ? [scanResult.rawText] : [];
    const totalCount = validFiles.length;
    let successfulCount = 0;
    const failedFlyers = [];

    try {
      for (let i = 0; i < totalCount; i++) {
        const file = validFiles[i];
        const previewItem = newPreviews[i];
        const flyerNum = prevCount + i + 1;
        const fileName = previewItem?.name || `Screenshot #${flyerNum}`;
        const flyerId = previewItem?.id || `flyer_${flyerNum}`;

        setBatchStatus({
          current: i + 1,
          total: totalCount,
          currentName: fileName
        });

        // Calculate progress percentage
        const baseProgress = Math.round(((i + 0.15) / totalCount) * 100);
        setScanProgress((p) => Math.max(p, baseProgress));

        try {
          const result = await processSingleFile(file, engineToUse, defaults);

          if (result && result.success && Array.isArray(result.records)) {
            successfulCount++;
            // Tag each record with its source flyer name & id for review clarity
            const taggedRecords = result.records.map(r => ({
              ...r,
              source_flyer_id: flyerId,
              source_file: fileName
            }));
            newRecords.push(...taggedRecords);

            if (result.rawText) {
              allRawTexts.push(`=== FLYER ${flyerNum}: ${fileName} ===\n${result.rawText}`);
            }
          } else {
            failedFlyers.push(`${fileName}${result?.error ? `: ${result.error}` : ''}`);
          }
        } catch (itemErr) {
          console.error(`Error processing flyer ${flyerNum} (${fileName}):`, itemErr);
          failedFlyers.push(`${fileName}: ${itemErr.message || 'scan failed'}`);
        }

        setScanProgress(Math.round(((i + 1) / totalCount) * 100));

        // Polite delay between batch requests to respect free-tier rate limits
        if (i < totalCount - 1 && engineToUse === 'gemini') {
          await new Promise(r => setTimeout(r, 600));
        }
      }

      // Merge newly extracted records with existing records
      const mergedRecords = [...existingRecords];
      for (const nr of newRecords) {
        const existingIdx = mergedRecords.findIndex(er => 
          er.travel_date === nr.travel_date &&
          er.origin?.toUpperCase() === nr.origin?.toUpperCase() &&
          er.destination?.toUpperCase() === nr.destination?.toUpperCase() &&
          er.airline_code?.toUpperCase() === nr.airline_code?.toUpperCase() &&
          (er.cabin || 'ECONOMY').toUpperCase() === (nr.cabin || 'ECONOMY').toUpperCase()
        );

        if (existingIdx !== -1) {
          // Update existing rate with the newer flyer's rate
          mergedRecords[existingIdx] = nr;
        } else {
          mergedRecords.push(nr);
        }
      }

      if (mergedRecords.length > 0) {
        const sorted = sortRecordsByRouteAndDate(mergedRecords);
        const combinedRaw = allRawTexts.join('\n\n');

        setScanResult({
          success: true,
          records: sorted,
          rawText: combinedRaw,
          confidence: 99
        });
        setRawTextEdit(combinedRaw);

        let statusText = '';
        if (isAppend) {
          statusText = `🎉 Added ${newRecords.length} new fares from ${validFiles.length > 1 ? `${validFiles.length} flyers` : `Screenshot #${prevCount + 1}`}! Total: ${sorted.length} fares across ${combinedFiles.length} screenshots.`;
        } else if (totalCount === 1) {
          statusText = `🎉 ${engineToUse === 'openai' ? 'ChatGPT' : engineToUse === 'gemini' ? 'Google Gemini' : 'OCR'} successfully extracted ${sorted.length} dates & fares!`;
        } else {
          statusText = `🎉 Successfully scanned ${successfulCount} of ${totalCount} flyers! Extracted ${sorted.length} total dates & fares.`;
        }

        if (failedFlyers.length > 0) {
          statusText += ` (⚠️ Note: ${failedFlyers.join(', ')} could not be read).`;
        }

        setStatus({
          type: 'success',
          text: statusText
        });
      } else {
        const failText = failedFlyers.length
          ? `Rates nahi nikle. ${failedFlyers.join(' | ')}`
          : 'Failed to extract fares from the uploaded flyer(s). Please verify the images or try a different engine.';
        setExtractError(failText);
        setStatus({
          type: 'error',
          text: failText
        });
      }
    } catch (err) {
      console.error(err);
      let msg = err.message || 'Error processing images.';
      if (msg.includes('no credits') || msg.includes('billing') || msg.includes('quota')) {
        msg = '⚠️ OpenAI Account Notice: Aapke OpenAI account mein balance/credits nahi hai ($0 balance). Solution: Upar "✨ Google Gemini Vision" select karein (yeh 100% Free hai bina kisi payment ke!) ya "📋 Copy Prompt for chatgpt.com" use karein.';
      }
      setExtractError(msg);
      setStatus({ type: 'error', text: msg });
    } finally {
      clearInterval(progressTimer);
      setScanning(false);
      setBatchStatus(null);
    }
  };

  /**
   * Remove an individual flyer from the batch and remove its corresponding extracted fares
   */
  const handleRemoveFlyer = (indexToRemove) => {
    const flyerToRemove = filePreviews[indexToRemove];
    if (!flyerToRemove) return;

    if (flyerToRemove.url) {
      try { URL.revokeObjectURL(flyerToRemove.url); } catch (e) {}
    }

    const updatedFiles = uploadedFiles.filter((_, i) => i !== indexToRemove);
    const updatedPreviews = filePreviews.filter((_, i) => i !== indexToRemove);

    setUploadedFiles(updatedFiles);
    setFilePreviews(updatedPreviews);

    let nextPreviewIdx = activePreviewIndex;
    if (activePreviewIndex >= updatedPreviews.length) {
      nextPreviewIdx = Math.max(0, updatedPreviews.length - 1);
    }
    setActivePreviewIndex(nextPreviewIdx);

    if (updatedPreviews[nextPreviewIdx]) {
      setImageFile(updatedPreviews[nextPreviewIdx].file);
      setImagePreview(updatedPreviews[nextPreviewIdx].url);
    }

    if (scanResult && scanResult.records) {
      const targetId = flyerToRemove.id;
      const flyerName = flyerToRemove.name;
      const remainingRecords = scanResult.records.filter(r => 
        targetId ? r.source_flyer_id !== targetId : r.source_file !== flyerName
      );
      setScanResult(prev => ({
        ...prev,
        records: remainingRecords
      }));
      setStatus({
        type: 'info',
        text: `🗑️ Removed ${flyerName}. Remaining: ${remainingRecords.length} fares from ${updatedFiles.length} screenshot(s).`
      });
    }

    if (updatedFiles.length === 0) {
      handleReset();
    }
  };

  const handleProcessImage = (file, fileName = file?.name || 'uploaded-image.png', forcedEngine = null) => {
    return handleProcessFiles([file], forcedEngine);
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleProcessFiles(files);
    }
    if (e.target) e.target.value = '';
  };

  const handleRecordChange = (index, field, value) => {
    if (!scanResult) return;
    const updated = [...scanResult.records];
    updated[index] = { ...updated[index], [field]: value };
    setScanResult(prev => ({ ...prev, records: updated }));
  };

  const handleDeleteRecord = (index) => {
    if (!scanResult) return;
    const updated = scanResult.records.filter((_, idx) => idx !== index);
    setScanResult(prev => ({ ...prev, records: updated }));
  };

  const handleAddRecord = () => {
    const today = new Date().toISOString().slice(0, 10);
    const newRec = {
      origin: defaultOrigin,
      destination: defaultDestination,
      airline_code: defaultAirline,
      flight_number: '',
      travel_date: today,
      net_fare: 15000,
      cabin: 'ECONOMY',
      baggage: defaultBaggage,
      is_refundable: defaultRefundable
    };
    setScanResult(prev => ({
      ...prev,
      records: [...(prev?.records || []), newRec]
    }));
  };

  const handleLoadSampleFlyerText = () => {
    const flyerText = `AIR INDIA express AMRITSAR DUBAI
14 SEP 22000
15 SEP & 16 SEP & 17 SEP & 18 SEP 20800
19 SEP & 20 SEP 19500
21 SEP & 22 SEP 18500
23 SEP TO 02 OCT (ALL DATES) 17800
03 OCT TO 15 OCT (ALL DATES) 17500

AIR INDIA express AMRITSAR SHARJAH
15 SEP 21500
16 SEP & 17 SEP & 18 SEP 20500
19 SEP & 20 SEP 19500
22 SEP TO 30 SEP (ALL DATES) 18000
01 OCT TO 15 OCT (ALL DATES) 17500

IndiGo AMRITSAR SHARJAH
13 SEP & 14 SEP 22000
15 SEP 21500
16 SEP & 17 SEP & 18 SEP 20500
19 SEP & 20 SEP 19500
21 SEP & 22 SEP & 23 SEP 18500
24 SEP TO 02 OCT (ALL DATES) 17800
03 OCT TO 29 OCT (ALL DATES) 17000
BAGGAGE: 30 + 07 KG (NON REFUNDABLE)`;

    setRawTextEdit(flyerText);
  };

  const handleSaveKeys = () => {
    const newOpenAiKey = tempOpenAiKey.trim();
    const newGeminiKey = tempGeminiKey.trim();

    let targetEngine = selectedEngine;

    if (newOpenAiKey) {
      localStorage.setItem('travelx_openai_api_key', newOpenAiKey);
      setOpenAiKey(newOpenAiKey);
    }
    if (newGeminiKey) {
      localStorage.setItem('travelx_gemini_api_key', newGeminiKey);
      setGeminiKey(newGeminiKey);
      targetEngine = 'gemini';
      setSelectedEngine('gemini');
    }
    setIsKeyModalOpen(false);
    setStatus(null);

    // If an image is already loaded, automatically run AI scan with targetEngine!
    if (imageFile) {
      setTimeout(() => {
        handleProcessImage(imageFile, imageFile.name, targetEngine);
      }, 150);
    }
  };

  const handleCopyChatGptPrompt = () => {
    const promptText = `Please analyze this airline rate card flyer image and extract ALL flight rates into a clean date-wise list.
Format each row as:
Travel Date (YYYY-MM-DD), Origin Airport Code (3-letter), Destination Airport Code (3-letter), Airline Code (2-letter), Net Fare (Number only)

Instructions:
1. Handle all separate sectors (e.g. Amritsar to Dubai, Amritsar to Sharjah).
2. Expand streaks like "15 SEP & 16 SEP & 17 SEP 20800" into individual rows with that fare.
3. Expand date ranges like "23 SEP TO 02 OCT (ALL DATES) 17800" into each individual calendar date.
4. Output as a clean text list so I can paste it into my TravelX manager.`;

    navigator.clipboard.writeText(promptText);
    setCopyHelperStatus(true);
    setTimeout(() => setCopyHelperStatus(false), 3000);
  };

  const handleReparseRawText = async () => {
    if (!rawTextEdit || !rawTextEdit.trim()) {
      setStatus({ type: 'error', text: 'Text is empty. Please enter or paste flyer text.' });
      return;
    }
    try {
      setScanning(true);
      const defaults = {
        defaultOrigin,
        defaultDestination,
        defaultAirline,
        defaultBaggage,
        defaultRefundable
      };
      const parsed = await api.parseWhatsApp(rawTextEdit, defaults);
      setScanResult(prev => ({
        ...prev,
        records: parsed.records || [],
        metadata: parsed.metadata || {}
      }));
      if (!parsed.records || parsed.records.length === 0) {
        setStatus({
          type: 'info',
          text: 'No dates or fares could be identified in the text. Check date formats (e.g. 15 SEP 20000).'
        });
      } else {
        setStatus({
          type: 'success',
          text: `🎉 Successfully parsed ${parsed.records.length} date & fare records from text!`
        });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: 'Failed to re-parse text.' });
    } finally {
      setScanning(false);
    }
  };

  const handleSaveToVendor = async (andSort = false) => {
    if (!scanResult || !scanResult.records || scanResult.records.length === 0) {
      setSaveFeedback({ type: 'error', text: 'No fares to save. Please scan an image first.' });
      setStatus({ type: 'error', text: 'No fares to save. Please scan an image first.' });
      return;
    }

    const validRows = scanResult.records.filter(r => r.travel_date && Number(r.net_fare) > 0);
    if (validRows.length === 0) {
      setSaveFeedback({ type: 'error', text: 'Please ensure dates and fares are valid.' });
      setStatus({ type: 'error', text: 'Please ensure dates and fares are valid.' });
      return;
    }

    try {
      setSaving(true);
      setSaveFeedback({ type: 'info', text: `Saving ${validRows.length} fares to ${vendorName}...` });
      setStatus(null);

      const formattedFares = validRows.map(r => {
        let air = (r.airline_code || defaultAirline).toUpperCase().trim();
        // Client-side guard for airline code
        if (air === 'IN' || air.includes('INDIGO')) air = '6E';
        if (air === 'SP' || air.includes('SPICE')) air = 'SG';
        if (air.includes('EXPRESS')) air = 'IX';

        return {
          airline_code: air,
          origin: (r.origin || defaultOrigin).toUpperCase(),
          destination: (r.destination || defaultDestination).toUpperCase(),
          flight_number: r.flight_number || '',
          travel_date: r.travel_date,
          net_fare: Number(r.net_fare),
          cabin: r.cabin || 'ECONOMY',
          baggage: r.baggage || defaultBaggage,
          is_refundable: r.is_refundable || defaultRefundable,
          remarks: `Image OCR: ${uploadedFiles.length > 1 ? `${uploadedFiles.length} Flyers` : (imageFile?.name || 'Screenshot')}`
        };
      });

      const res = await onFaresSaved(formattedFares, andSort, autoDeleteMissing);
      if (res && res.success !== false) {
        setSaveFeedback({ 
          type: 'success', 
          text: res.message || `🎉 Successfully saved ${validRows.length} fares to ${vendorName}!` 
        });
        setTimeout(() => {
          handleReset();
        }, 1200);
      } else {
        const errorMsg = (res && res.error) || 'Failed to save scanned fares.';
        setSaveFeedback({ type: 'error', text: errorMsg });
        setStatus({ type: 'error', text: errorMsg });
      }
    } catch (err) {
      console.error(err);
      const errorMsg = err.message || 'Failed to save scanned fares.';
      setSaveFeedback({ type: 'error', text: errorMsg });
      setStatus({ type: 'error', text: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    filePreviews.forEach(p => {
      if (p.url) URL.revokeObjectURL(p.url);
    });
    setUploadedFiles([]);
    setFilePreviews([]);
    setActivePreviewIndex(0);
    setImageFile(null);
    setImagePreview(null);
    setScanResult(null);
    setStatus(null);
    setSaveFeedback(null);
    setScanProgress(0);
    setBatchStatus(null);
  };

  const handleLoadSampleFlyer = () => {
    // Generate a clean sample rate card image on a canvas for instant testing
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 640, 540);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#f8fafc');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 540);

    // Border
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, 624, 524);

    // Header bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(8, 8, 624, 80);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText('✈️ AIR INDIA EXPRESS - SPECIAL FARES', 24, 45);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillText('SECTOR: ATQ -> DXB (NON-STOP)', 24, 70);

    // Dates & Rates List
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('📅 DAILY SPECIAL FARES (ALL INCLUSIVE NET):', 30, 125);

    const sampleRows = [
      { date: '15-09-2026', fare: '₹ 18,500' },
      { date: '16-09-2026', fare: '₹ 19,000' },
      { date: '17-09-2026', fare: '₹ 18,500' },
      { date: '18-09-2026', fare: '₹ 19,200' },
      { date: '20-09-2026', fare: '₹ 18,800' },
      { date: '22-09-2026', fare: '₹ 19,500' },
      { date: '25-09-2026', fare: '₹ 18,900' }
    ];

    let y = 165;
    sampleRows.forEach((row, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#f1f5f9' : '#ffffff';
      ctx.fillRect(28, y - 24, 584, 34);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 15px monospace, sans-serif';
      ctx.fillText(`• ${row.date}`, 45, y);

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.fillText(row.fare, 440, y);

      y += 40;
    });

    // Footer
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(8, 470, 624, 62);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText('Baggage: 30kg + 7kg Cabin | Hand Baggage Only Non-Ref', 30, 505);

    canvas.toBlob((blob) => {
      if (blob) {
        handleProcessImage(blob, 'sample-rate-flyer.png');
      }
    }, 'image/png');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-800">
              <ImageIcon className="w-4 h-4" />
            </span>
            <span>Upload {vendorName}'s Rate Card Image / Screenshot</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            WhatsApp screenshot, vendor flyer, ya rate list upload karein ya direct <strong>Ctrl + V</strong> se paste karein. System text scan (OCR) karke dates & rates nikal lega!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden File Input for Adding Multiple Screenshots */}
          <input
            type="file"
            ref={addMoreFileInputRef}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) {
                const shouldAppend = appendMode && (uploadedFiles.length > 0 || (scanResult?.records?.length || 0) > 0);
                handleProcessFiles(files, null, shouldAppend);
              }
              if (e.target) e.target.value = '';
            }}
            accept="image/*"
            multiple
            className="hidden"
          />

          {/* Primary Action Button: Add / Paste More Screenshots */}
          <button
            type="button"
            onClick={() => addMoreFileInputRef.current?.click()}
            disabled={scanning}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
            title="Upload multiple screenshots or press Ctrl + V anytime"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>➕ Paste / Add Screenshots</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSampleFlyer}
            disabled={scanning}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            title="Generate a sample rate flyer image and run OCR to see how it works"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>🧪 Try Sample Flyer</span>
          </button>

          {(imageFile || uploadedFiles.length > 0) && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
              title="Clear all uploaded screenshots and extracted rates"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* AI Vision Engine Selection Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-sm border border-indigo-800/60 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Bot className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-black text-white">AI Vision Extractor Engine</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {selectedEngine === 'openai' ? '🤖 CHATGPT ACTIVE' : selectedEngine === 'gemini' ? '✨ GEMINI ACTIVE' : '🖥️ LOCAL OCR'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                ChatGPT (GPT-4o Vision) reads complex WhatsApp flyers, table borders, and streaks with 100% precision.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyChatGptPrompt}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
              title="Copy prompt to paste flyer directly into chatgpt.com"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>{copyHelperStatus ? '✓ Copied Prompt!' : '📋 Copy Prompt for chatgpt.com'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTempOpenAiKey(openAiKey);
                setTempGeminiKey(geminiKey);
                setIsKeyModalOpen(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Key className="w-3.5 h-3.5 text-amber-300" />
              <span>{openAiKey ? '⚙️ API Key Saved' : '🔑 Set AI API Key'}</span>
            </button>
          </div>
        </div>

        {/* Engine Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-indigo-900/50">
          <button
            type="button"
            onClick={() => { setSelectedEngine('openai'); setStatus(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              selectedEngine === 'openai'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700'
            }`}
          >
            <span>🤖 ChatGPT (GPT-4o Vision)</span>
            <span className="px-1.5 py-0.2 bg-emerald-950/30 text-emerald-950 text-[10px] rounded font-black">RECOMMENDED</span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedEngine('gemini'); setStatus(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              selectedEngine === 'gemini'
                ? 'bg-indigo-500 text-white font-black shadow-md'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700'
            }`}
          >
            <span>✨ Google Gemini Vision</span>
            <span className="px-1.5 py-0.2 bg-indigo-950/40 text-indigo-200 text-[10px] rounded font-black">FREE TIER</span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedEngine('ocr'); setStatus(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              selectedEngine === 'ocr'
                ? 'bg-white text-slate-900 font-black shadow-md'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 border border-slate-700'
            }`}
          >
            <span>🖥️ Local Browser OCR (Offline / Basic)</span>
          </button>
        </div>
      </div>

      {/* API Key Configuration Modal */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Key className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900">AI Vision API Key Settings</h3>
                  <p className="text-xs text-slate-500">Only needed once. Saved securely in your browser.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* OpenAI / ChatGPT Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <span>🤖 OpenAI (ChatGPT) API Key</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-black">RECOMMENDED</span>
                </label>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline flex items-center space-x-0.5 font-bold"
                >
                  <span>Get Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="password"
                value={tempOpenAiKey}
                onChange={(e) => setTempOpenAiKey(e.target.value)}
                placeholder="sk-proj-... or sk-..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-500">
                Used for GPT-4o-mini Vision extraction. Costs ~₹0.02 per scan.
              </p>
            </div>

            {/* Google Gemini Key */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <span>✨ Google Gemini API Key</span>
                  <span className="text-[10px] text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded font-black">FREE TIER AVAILABLE</span>
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline flex items-center space-x-0.5 font-bold"
                >
                  <span>Get Free Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="password"
                value={tempGeminiKey}
                onChange={(e) => setTempGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-500">
                100% Free on Google AI Studio (up to 15 scans per minute free).
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveKeys}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>Save API Key</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div className={`p-4 rounded-xl flex items-center space-x-3 text-xs font-bold animate-fade-in ${
          status.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' 
            : status.type === 'error'
            ? 'bg-rose-50 text-rose-900 border border-rose-300'
            : 'bg-blue-50 text-blue-900 border border-blue-300'
        }`}>
          {status.type === 'success' ? (
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{status.text}</span>
        </div>
      )}

      {/* Default Fallback Settings Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-extrabold uppercase text-slate-700 text-[10px] tracking-wider">
            ⚙️ Fallback Sector & Airline (used if not detected in image):
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Auto-applied to scanned dates
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Origin</label>
            <input
              type="text"
              value={defaultOrigin}
              onChange={(e) => setDefaultOrigin(e.target.value.toUpperCase())}
              maxLength={3}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 font-bold text-slate-900 text-center uppercase"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Destination</label>
            <input
              type="text"
              value={defaultDestination}
              onChange={(e) => setDefaultDestination(e.target.value.toUpperCase())}
              maxLength={3}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 font-bold text-slate-900 text-center uppercase"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Airline</label>
            <select
              value={defaultAirline}
              onChange={(e) => setDefaultAirline(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 font-bold text-slate-900 text-xs"
            >
              {combinedAirlines.map(a => (
                <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Baggage</label>
            <input
              type="text"
              value={defaultBaggage}
              onChange={(e) => setDefaultBaggage(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800"
              placeholder="30kg"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Refundable</label>
            <select
              value={defaultRefundable}
              onChange={(e) => setDefaultRefundable(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 text-xs"
            >
              <option value="NON_REFUNDABLE">Non-Refundable</option>
              <option value="REFUNDABLE">Refundable</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Upload Drop Area */}
      {!imageFile && uploadedFiles.length === 0 ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files || []).filter(f => f.type?.startsWith('image/'));
            if (files.length > 0) {
              handleProcessFiles(files);
            }
          }}
          className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/20 hover:bg-emerald-50/40 rounded-2xl p-8 sm:p-12 text-center transition cursor-pointer space-y-3"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept="image/*"
            multiple
            className="hidden"
          />

          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-sm font-black text-slate-900">
              Drop rate card images here (Single or Multiple), or click to browse
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Select multiple PNG, JPG, JPEG, WEBP screenshots of WhatsApp quotes or flyers at once
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white border border-emerald-200 rounded-full text-emerald-800 font-bold text-xs shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>⚡ Bulk Upload Supported: Multiple images ek sath upload karein (Queue mode me 100% accuracy)</span>
            </span>
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white border border-emerald-200 rounded-full text-emerald-800 font-bold text-xs shadow-2xs">
              <span>Pro-Tip: Press <strong>Ctrl + V</strong> anywhere on this screen to paste!</span>
            </span>
          </div>
        </div>
      ) : (
        /* Image Preview & Scan Progress */
        <div className="space-y-4">
          {/* Multiple Screenshots Mode Helper Banner */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center space-x-2 text-xs">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-extrabold text-emerald-950">Multiple Screenshots Mode Active:</span>
              <span className="text-emerald-800 text-[11px]">
                WhatsApp se doosra screenshot copy karke seedha <kbd className="px-1.5 py-0.5 bg-white border border-emerald-300 rounded font-mono font-bold text-[10px] text-emerald-900 shadow-2xs">Ctrl + V</kbd> dabayein ya <strong>"+ Add Next Flyer"</strong> use karein — naye rates yahan automatically jud jayenge!
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => addMoreFileInputRef.current?.click()}
                disabled={scanning}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add / Paste Next Flyer</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Column: Image Thumbnail & Carousel */}
            <div className="md:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5 truncate max-w-[200px]">
                  <span className="font-bold text-slate-700 truncate">
                    {filePreviews[activePreviewIndex]?.name || imageFile?.name || 'Screenshot'}
                  </span>
                  {filePreviews.length > 1 && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-black shrink-0">
                      {activePreviewIndex + 1}/{filePreviews.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-rose-600 hover:text-rose-800 font-bold text-[11px] cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              {/* Thumbnail Strip for Multi-Image (Visible whenever filePreviews.length > 0) */}
              {filePreviews.length > 0 && (
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 px-0.5">
                    <div className="flex items-center space-x-1.5">
                      <span>Flyers Gallery ({filePreviews.length}):</span>
                      <span className="text-emerald-700 font-medium">• Ctrl + V to paste</span>
                    </div>
                    <span className="text-indigo-600 font-mono">Click to preview</span>
                  </div>
                  <div className="flex items-center space-x-2 overflow-x-auto pb-1 pt-0.5">
                    {filePreviews.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        onClick={() => {
                          setActivePreviewIndex(idx);
                          setImageFile(p.file);
                          setImagePreview(p.url);
                        }}
                        className={`group relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                          activePreviewIndex === idx
                            ? 'border-indigo-600 ring-2 ring-indigo-400 scale-105 shadow-sm'
                            : 'border-slate-200 hover:border-slate-400 opacity-75 hover:opacity-100'
                        }`}
                        title={`${p.name} - Click to preview`}
                      >
                        <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 right-0 bg-slate-900/90 text-white text-[9px] font-mono font-bold px-1 rounded-tl">
                          #{idx + 1}
                        </span>
                        {/* Individual flyer delete button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFlyer(idx);
                          }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-xs text-[9px] font-bold cursor-pointer"
                          title={`Remove ${p.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {/* Add More Flyer Thumbnail Button inside gallery */}
                    <button
                      type="button"
                      onClick={() => addMoreFileInputRef.current?.click()}
                      disabled={scanning}
                      className="relative shrink-0 w-14 h-14 rounded-lg border-2 border-dashed border-emerald-400 hover:border-emerald-600 bg-emerald-50/60 hover:bg-emerald-100/90 flex flex-col items-center justify-center text-emerald-700 transition cursor-pointer disabled:opacity-50 group"
                      title="Upload or paste another screenshot (Ctrl + V)"
                    >
                      <Plus className="w-4 h-4 group-hover:scale-110 transition" />
                      <span className="text-[8px] font-bold mt-0.5">+ Flyer</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Main Preview Image */}
            <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-white max-h-72 flex items-center justify-center">
              <img
                src={filePreviews[activePreviewIndex]?.url || imagePreview}
                alt="Rate card preview"
                className="w-full h-auto object-contain max-h-72"
              />
              {scanning && (
                <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 space-y-3">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                  <div className="text-center space-y-1">
                    <p className="font-black text-xs">
                      {batchStatus ? (
                        `Scanning Flyer ${batchStatus.current} of ${batchStatus.total}...`
                      ) : selectedEngine === 'openai' ? (
                        'ChatGPT (GPT-4o Vision) analyzing flyer...'
                      ) : selectedEngine === 'gemini' ? (
                        'Google Gemini Vision reading flyer...'
                      ) : (
                        'Local OCR scanning...'
                      )}
                    </p>
                    {batchStatus && (
                      <p className="text-[10px] text-indigo-200 truncate max-w-[190px] font-mono mx-auto">
                        {batchStatus.currentName}
                      </p>
                    )}
                    <p className="text-[11px] text-emerald-300 font-mono font-bold">{scanProgress}%</p>
                    {selectedEngine === 'gemini' && scanProgress < 90 && (
                      <p className="text-[10px] text-slate-300 max-w-[220px] leading-snug">
                        Screenshot compress ho rahi hai, phir Gemini dates nikalega. Excel isse tez hai.
                      </p>
                    )}
                  </div>
                  <div className="w-48 bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-emerald-400 h-full transition-all duration-300" 
                      style={{ width: `${scanProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Direct Action Scan Button */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => handleProcessFiles(uploadedFiles.length > 0 ? uploadedFiles : [imageFile])}
                disabled={scanning}
                className={`w-full py-3 px-4 font-black text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50 active:scale-[0.98] ${
                  selectedEngine === 'openai'
                    ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-emerald-900/20'
                    : selectedEngine === 'gemini'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                {scanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>
                      {batchStatus
                        ? `Scanning Flyer ${batchStatus.current} of ${batchStatus.total} (${scanProgress}%)...`
                        : `Scanning Flyer (${scanProgress}%)...`}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    <span>
                      {uploadedFiles.length > 1
                        ? `🚀 Scan All ${uploadedFiles.length} Flyers (${selectedEngine === 'openai' ? 'ChatGPT' : selectedEngine === 'gemini' ? 'Gemini Vision' : 'OCR'})`
                        : selectedEngine === 'openai'
                        ? '🚀 Scan Image with ChatGPT (GPT-4o)'
                        : selectedEngine === 'gemini'
                        ? '✨ Scan Image with Gemini Vision'
                        : '🖥️ Run Local OCR Scan'}
                    </span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  <span>Engine: <strong className="text-slate-800 uppercase">{selectedEngine}</strong></span>
                </span>
                {scanResult && (
                  <button
                    type="button"
                    onClick={() => setIsRawTextOpen(prev => !prev)}
                    className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                  >
                    {isRawTextOpen ? 'Hide Raw Text' : 'View Scanned Text'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Extracted Fares Table */}
          <div className="md:col-span-8 space-y-4">
            {isRawTextOpen && (
              <div className="bg-slate-900 text-slate-200 rounded-xl p-3.5 text-xs font-mono space-y-2.5 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between text-slate-300">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold">Scanned Flyer Text Editor</span>
                    <span className="text-[10px] text-slate-400 font-sans">(Verify, edit or paste WhatsApp flyer text)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRawTextOpen(false)}
                    className="text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-slate-800 text-xs font-sans cursor-pointer"
                  >
                    ✕ Close
                  </button>
                </div>
                <textarea
                  value={rawTextEdit}
                  onChange={(e) => setRawTextEdit(e.target.value)}
                  placeholder="Paste WhatsApp text or flyer text here (e.g. 15 SEP 18500)..."
                  rows={6}
                  className="w-full bg-slate-950 p-2.5 rounded border border-slate-700 text-[12px] font-mono text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleLoadSampleFlyerText}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-xs font-sans transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                      title="Load complete clean text of this WhatsApp flyer"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>📋 Load Clean Flyer Text</span>
                    </button>
                    <span className="text-[10px] text-slate-400 font-sans hidden md:inline">
                      ✨ Supports streaks (15 & 16 SEP) & ranges (23 SEP TO 02 OCT)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleReparseRawText}
                    disabled={scanning}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm text-xs font-sans disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                    <span>⚡ Re-parse Fares into Table</span>
                  </button>
                </div>
              </div>
            )}

            {!scanResult && !isRawTextOpen && (
              <div className="bg-white border-2 border-dashed border-indigo-200/80 rounded-2xl p-10 text-center space-y-4 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-2xs">
                  <Sparkles className="w-7 h-7 animate-pulse text-indigo-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-900">
                    Flyer Image Uploaded & Ready!
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Neeche button par click karein — Google Gemini flyer se sabhi <strong>100+ dates aur fares</strong> nikal kar is table mein daal dega!
                  </p>
                  {extractError && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 max-w-md mx-auto text-left">
                      {extractError}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleProcessImage(imageFile, imageFile.name, selectedEngine)}
                  disabled={scanning}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition active:scale-95 flex items-center justify-center space-x-2 mx-auto disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>🚀 Scan Image with {selectedEngine === 'gemini' ? 'Google Gemini Vision' : selectedEngine === 'openai' ? 'ChatGPT' : 'OCR'}</span>
                </button>
              </div>
            )}

            {scanResult && scanResult.records && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Extracted Flight Rates ({scanResult.records.length} dates{filePreviews.length > 1 ? ` from ${filePreviews.length} flyers` : ''})
                    </h3>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Ready to Save
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleSortByRouteAndDate}
                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-2xs"
                      title="Sort Route-wise (ATQ-DXB, ATQ-SHJ), then Date-wise"
                    >
                      <span>🔀 Route & Date Wise</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddRecord}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                    >
                      <span>+ Add Row</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-80">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold uppercase sticky top-0">
                      <tr>
                        <th className="px-2.5 py-2 text-center w-8">#</th>
                        {filePreviews.length > 1 && (
                          <th className="px-2 py-2 text-left w-20 text-[10px] text-slate-500">Source</th>
                        )}
                        <th 
                          onClick={handleSortByRouteAndDate}
                          className="px-2.5 py-2 text-left w-28 cursor-pointer hover:text-indigo-600 transition select-none"
                          title="Click to sort Route-wise then Date-wise"
                        >
                          <span className="flex items-center space-x-1">
                            <span>Route</span>
                            <span className="text-[10px] text-indigo-500 font-bold">↕</span>
                          </span>
                        </th>
                        <th className="px-2.5 py-2 text-left w-44">Airline Name</th>
                        <th 
                          onClick={handleSortByDateOnly}
                          className="px-2.5 py-2 text-left w-32 cursor-pointer hover:text-indigo-600 transition select-none"
                          title="Click to sort Date-wise"
                        >
                          <span className="flex items-center space-x-1">
                            <span>Travel Date</span>
                            <span className="text-[10px] text-indigo-500 font-bold">↕</span>
                          </span>
                        </th>
                        <th className="px-2.5 py-2 text-right w-28">Net Fare (₹)</th>
                        <th className="px-2.5 py-2 text-center w-20">Baggage</th>
                        <th className="px-2.5 py-2 text-center w-10">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scanResult.records.length === 0 ? (
                        <tr>
                          <td colSpan={filePreviews.length > 1 ? 8 : 7} className="py-8 text-center text-slate-400 text-xs">
                            No dates could be parsed from this image. Click "+ Add Row" to add rates manually or re-upload a clearer image.
                          </td>
                        </tr>
                      ) : (
                        scanResult.records.map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="px-2.5 py-2 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            {filePreviews.length > 1 && (
                              <td className="px-2 py-1.5 whitespace-nowrap">
                                <span 
                                  className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 truncate max-w-[80px] block font-mono" 
                                  title={r.source_file || 'Flyer'}
                                >
                                  {r.source_file ? (r.source_file.length > 10 ? `${r.source_file.slice(0, 9)}…` : r.source_file) : 'Flyer'}
                                </span>
                              </td>
                            )}
                            
                            <td className="px-2.5 py-1.5 font-bold text-blue-700">
                              <div className="flex items-center space-x-1">
                                <input
                                  type="text"
                                  value={r.origin || defaultOrigin}
                                  onChange={(e) => handleRecordChange(idx, 'origin', e.target.value.toUpperCase())}
                                  className="w-11 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-center uppercase font-bold"
                                  maxLength={3}
                                />
                                <span>→</span>
                                <input
                                  type="text"
                                  value={r.destination || defaultDestination}
                                  onChange={(e) => handleRecordChange(idx, 'destination', e.target.value.toUpperCase())}
                                  className="w-11 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-center uppercase font-bold"
                                  maxLength={3}
                                />
                              </div>
                            </td>

                            <td className="px-2.5 py-1.5 font-bold text-slate-800">
                              <select
                                value={r.airline_code || defaultAirline}
                                onChange={(e) => handleRecordChange(idx, 'airline_code', e.target.value.toUpperCase())}
                                className="w-full min-w-[145px] max-w-[175px] px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs cursor-pointer truncate"
                                title={getAirlineDisplayName(r.airline_code)}
                              >
                                {combinedAirlines.map(a => (
                                  <option key={a.code} value={a.code}>
                                    {a.name} ({a.code})
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="px-2.5 py-1.5">
                              <input
                                type="date"
                                value={r.travel_date || ''}
                                onChange={(e) => handleRecordChange(idx, 'travel_date', e.target.value)}
                                className="w-32 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-900"
                              />
                            </td>

                            <td className="px-2.5 py-1.5 text-right font-black text-slate-950">
                              <div className="inline-flex items-center space-x-1">
                                <span className="text-slate-400">₹</span>
                                <input
                                  type="number"
                                  value={r.net_fare ?? ''}
                                  onChange={(e) => handleRecordChange(idx, 'net_fare', e.target.value)}
                                  className="w-24 px-1.5 py-0.5 bg-white border border-emerald-300 rounded text-right font-black text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>
                            </td>

                            <td className="px-2.5 py-1.5 text-center">
                              <input
                                type="text"
                                value={r.baggage || defaultBaggage}
                                onChange={(e) => handleRecordChange(idx, 'baggage', e.target.value)}
                                className="w-16 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-center text-[11px]"
                              />
                            </td>

                            <td className="px-2.5 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title="Remove row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Action Save Strip */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="text-xs text-slate-600">
                      Total: <strong className="text-emerald-700 font-bold">{scanResult.records.length} Fares</strong> scanned from image
                    </div>

                    {/* Auto-delete missing dates toggle */}
                    <label className="flex items-center space-x-1.5 text-xs text-slate-700 bg-amber-50/80 px-2.5 py-1.5 rounded-lg border border-amber-200/80 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoDeleteMissing}
                        onChange={(e) => setAutoDeleteMissing(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="font-semibold text-[11px] text-amber-900">
                        🔄 Auto-delete missing dates (Flyer Sync)
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    {saveFeedback && (
                      <div className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 animate-fade-in ${
                        saveFeedback.type === 'success' 
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                          : saveFeedback.type === 'error'
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : 'bg-blue-100 text-blue-900 border border-blue-300'
                      }`}>
                        {saveFeedback.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : saveFeedback.type === 'error' ? (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                        )}
                        <span className="truncate max-w-xs sm:max-w-md">{saveFeedback.text}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleSaveToVendor(false)}
                        disabled={saving || scanResult.records.length === 0}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {saving ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        <span>{saving ? 'Saving...' : `Save to ${vendorName}`}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveToVendor(true)}
                        disabled={saving || scanResult.records.length === 0}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <span>Save & Compare</span>
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
