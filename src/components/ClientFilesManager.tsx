import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  FolderDown, 
  ExternalLink, 
  BookOpen, 
  ChevronLeft, 
  Check, 
  RefreshCw, 
  Lock, 
  X, 
  FileSpreadsheet, 
  FileCode, 
  FileImage, 
  FileVideo, 
  FileAudio, 
  FileArchive, 
  File,
  Eye,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export type FileTypeCategory = 'all' | 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'video' | 'audio' | 'zip' | 'text' | 'generic';

export interface ExtractedFileItem {
  key: string;
  name: string;
  url: string;
  courseId: string;
  courseTitle: string;
  courseInitials?: string;
  moduleId?: string;
  moduleTitle?: string;
  sourceType: 'ebook' | 'guide' | 'module_file';
  paymentStatus: string; // 'approved' | 'pending' | 'rejected'
  createdAt?: string;
}

interface ClientFilesManagerProps {
  registrations: any[];
  userId?: string;
  onBack?: () => void;
}

export function getFileTypeMeta(fileName: string = '', url: string = '') {
  const cleanStr = (fileName + ' ' + url).toLowerCase();

  if (cleanStr.includes('.pdf') || cleanStr.includes('pdf')) {
    return {
      category: 'pdf' as FileTypeCategory,
      label: 'PDF',
      extension: 'PDF',
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/40',
      border: 'border-red-200 dark:border-red-800/60',
      badge: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300 border-red-200 dark:border-red-800',
      icon: FileText
    };
  }

  if (cleanStr.includes('.doc') || cleanStr.includes('.docx') || cleanStr.includes('word')) {
    return {
      category: 'word' as FileTypeCategory,
      label: 'Word',
      extension: 'DOCX',
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-200 dark:border-blue-800/60',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      icon: FileText
    };
  }

  if (cleanStr.includes('.xls') || cleanStr.includes('.xlsx') || cleanStr.includes('.csv') || cleanStr.includes('excel') || cleanStr.includes('tableur')) {
    return {
      category: 'excel' as FileTypeCategory,
      label: 'Excel',
      extension: 'XLSX',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800/60',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      icon: FileSpreadsheet
    };
  }

  if (cleanStr.includes('.ppt') || cleanStr.includes('.pptx') || cleanStr.includes('powerpoint') || cleanStr.includes('presentation') || cleanStr.includes('slide')) {
    return {
      category: 'powerpoint' as FileTypeCategory,
      label: 'PowerPoint',
      extension: 'PPTX',
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-950/40',
      border: 'border-orange-200 dark:border-orange-800/60',
      badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300 border-orange-200 dark:border-orange-800',
      icon: FileText
    };
  }

  if (cleanStr.includes('.jpg') || cleanStr.includes('.jpeg') || cleanStr.includes('.png') || cleanStr.includes('.gif') || cleanStr.includes('.webp') || cleanStr.includes('.svg') || cleanStr.includes('image')) {
    return {
      category: 'image' as FileTypeCategory,
      label: 'Image',
      extension: 'IMG',
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      border: 'border-purple-200 dark:border-purple-800/60',
      badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      icon: FileImage
    };
  }

  if (cleanStr.includes('.mp4') || cleanStr.includes('.mov') || cleanStr.includes('.avi') || cleanStr.includes('.mkv') || cleanStr.includes('video')) {
    return {
      category: 'video' as FileTypeCategory,
      label: 'Vidéo',
      extension: 'MP4',
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-800/60',
      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      icon: FileVideo
    };
  }

  if (cleanStr.includes('.mp3') || cleanStr.includes('.wav') || cleanStr.includes('.aac') || cleanStr.includes('audio')) {
    return {
      category: 'audio' as FileTypeCategory,
      label: 'Audio',
      extension: 'MP3',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800/60',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      icon: FileAudio
    };
  }

  if (cleanStr.includes('.zip') || cleanStr.includes('.rar') || cleanStr.includes('.7z') || cleanStr.includes('.tar') || cleanStr.includes('archive')) {
    return {
      category: 'zip' as FileTypeCategory,
      label: 'Archive',
      extension: 'ZIP',
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-950/40',
      border: 'border-yellow-200 dark:border-yellow-800/60',
      badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
      icon: FileArchive
    };
  }

  if (cleanStr.includes('.txt') || cleanStr.includes('.md')) {
    return {
      category: 'text' as FileTypeCategory,
      label: 'Texte',
      extension: 'TXT',
      color: 'text-slate-600 dark:text-slate-400',
      bg: 'bg-slate-50 dark:bg-slate-900/40',
      border: 'border-slate-200 dark:border-slate-800',
      badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      icon: FileCode
    };
  }

  return {
    category: 'generic' as FileTypeCategory,
    label: 'Document',
    extension: 'DOC',
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-indigo-200 dark:border-indigo-800/60',
    badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    icon: File
  };
}

export default function ClientFilesManager({ registrations, userId, onBack }: ClientFilesManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<FileTypeCategory>('all');
  const [downloadStatusFilter, setDownloadStatusFilter] = useState<'all' | 'downloaded' | 'not_downloaded'>('all');
  const [viewMode, setViewMode] = useState<'by_course' | 'flat'>('by_course');

  // Track downloaded state in localStorage
  const localStorageKey = useMemo(() => `downloaded_files_${userId || 'guest'}`, [userId]);
  
  const [downloadedKeys, setDownloadedKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(localStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(downloadedKeys));
    } catch (e) {
      console.warn("Error saving downloaded files state", e);
    }
  }, [downloadedKeys, localStorageKey]);

  // Extract all files from registrations
  const allFiles = useMemo(() => {
    const list: ExtractedFileItem[] = [];

    registrations.forEach(reg => {
      const course = reg.courses;
      if (!course) return;

      const courseTitle = course.title || 'Formation';
      const courseInitials = course.initials;
      const paymentStatus = reg.payment_status || 'pending';

      // 1. Course Download File (E-book or main resource)
      if (course.download_file_url) {
        list.push({
          key: `course_${course.id}_download`,
          name: course.product_type === 'ebook' ? `E-Book : ${courseTitle}` : `Support principal : ${courseTitle}`,
          url: course.download_file_url,
          courseId: course.id,
          courseTitle,
          courseInitials,
          sourceType: 'ebook',
          paymentStatus
        });
      }

      // 2. Course Guide
      if (course.guide_url) {
        list.push({
          key: `course_${course.id}_guide`,
          name: `Guide de formation - ${courseTitle}`,
          url: course.guide_url,
          courseId: course.id,
          courseTitle,
          courseInitials,
          sourceType: 'guide',
          paymentStatus
        });
      }

      // 3. Module Files
      const modules = course.course_modules || [];
      modules.forEach((mod: any, mIdx: number) => {
        const modTitle = mod.title || `Module ${mIdx + 1}`;

        // DB table module_files relation
        if (mod.module_files && mod.module_files.length > 0) {
          mod.module_files.forEach((f: any) => {
            if (f.url) {
              list.push({
                key: `file_${f.id}`,
                name: f.name || `Support Module ${mIdx + 1}`,
                url: f.url,
                courseId: course.id,
                courseTitle,
                courseInitials,
                moduleId: mod.id,
                moduleTitle: modTitle,
                sourceType: 'module_file',
                paymentStatus,
                createdAt: f.created_at
              });
            }
          });
        }

        // download_files JSON array in course_modules
        if (mod.download_files && Array.isArray(mod.download_files)) {
          mod.download_files.forEach((f: any, fIdx: number) => {
            // Exclude sessions
            if (f.type !== 'session' && f.url) {
              // Avoid duplicates if already added from module_files
              const key = `mod_json_${mod.id}_${fIdx}_${f.url.slice(-15)}`;
              if (!list.some(item => item.url === f.url)) {
                list.push({
                  key,
                  name: f.name || `Ressource Module ${mIdx + 1}`,
                  url: f.url,
                  courseId: course.id,
                  courseTitle,
                  courseInitials,
                  moduleId: mod.id,
                  moduleTitle: modTitle,
                  sourceType: 'module_file',
                  paymentStatus
                });
              }
            }
          });
        }
      });
    });

    return list;
  }, [registrations]);

  // Unique list of courses for filtering
  const enrolledCoursesList = useMemo(() => {
    const map = new Map<string, { id: string; title: string; initials?: string }>();
    registrations.forEach(r => {
      if (r.courses) {
        map.set(r.courses.id, {
          id: r.courses.id,
          title: r.courses.title,
          initials: r.courses.initials
        });
      }
    });
    return Array.from(map.values());
  }, [registrations]);

  // Filtered files computation
  const filteredFiles = useMemo(() => {
    return allFiles.filter(item => {
      // 1. Course Filter
      if (selectedCourseId !== 'all' && item.courseId !== selectedCourseId) {
        return false;
      }

      // 2. File Type Category Filter
      const meta = getFileTypeMeta(item.name, item.url);
      if (selectedCategory !== 'all' && meta.category !== selectedCategory) {
        return false;
      }

      // 3. Downloaded Status Filter
      const isDownloaded = downloadedKeys.includes(item.key) || downloadedKeys.includes(item.url);
      if (downloadStatusFilter === 'downloaded' && !isDownloaded) {
        return false;
      }
      if (downloadStatusFilter === 'not_downloaded' && isDownloaded) {
        return false;
      }

      // 4. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCourse = item.courseTitle.toLowerCase().includes(q);
        const matchModule = item.moduleTitle ? item.moduleTitle.toLowerCase().includes(q) : false;
        const matchExt = meta.extension.toLowerCase().includes(q) || meta.label.toLowerCase().includes(q);
        if (!matchName && !matchCourse && !matchModule && !matchExt) {
          return false;
        }
      }

      return true;
    });
  }, [allFiles, selectedCourseId, selectedCategory, downloadStatusFilter, searchQuery, downloadedKeys]);

  // Statistics
  const totalCount = allFiles.length;
  const downloadedCount = allFiles.filter(f => downloadedKeys.includes(f.key) || downloadedKeys.includes(f.url)).length;
  const pendingDownloadCount = totalCount - downloadedCount;

  // Group files by course for 'by_course' view
  const filesByCourse = useMemo(() => {
    const groups: { [courseId: string]: { courseInfo: any; files: ExtractedFileItem[] } } = {};
    
    filteredFiles.forEach(file => {
      if (!groups[file.courseId]) {
        const reg = registrations.find(r => r.course_id === file.courseId);
        groups[file.courseId] = {
          courseInfo: reg?.courses || { id: file.courseId, title: file.courseTitle, initials: file.courseInitials },
          files: []
        };
      }
      groups[file.courseId].files.push(file);
    });

    return Object.values(groups);
  }, [filteredFiles, registrations]);

  const toggleDownloadState = (key: string, url: string) => {
    setDownloadedKeys(prev => {
      const isAlready = prev.includes(key) || prev.includes(url);
      if (isAlready) {
        return prev.filter(k => k !== key && k !== url);
      } else {
        return [...prev, key];
      }
    });
  };

  const handleDownload = (file: ExtractedFileItem) => {
    if (file.paymentStatus !== 'approved') return;

    // Mark as downloaded
    if (!downloadedKeys.includes(file.key)) {
      setDownloadedKeys(prev => [...prev, file.key]);
    }

    // Open file link
    window.open(file.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xs">
        <div className="flex items-start gap-2.5 sm:gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 sm:p-2 -ml-1 sm:-ml-2 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              title="Retour à l'accueil"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 sm:p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                <FolderDown className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <h2 className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                Bibliothèque de Fichiers
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 mt-1 leading-snug">
              Retrouvez tous vos supports de cours, guides PDF et e-books classés par formation.
            </p>
          </div>
        </div>

        {/* View Mode Toggle & Summary Pill */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-auto bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl border border-gray-200/80 dark:border-slate-700/80 flex items-center text-xs font-bold">
            <button
              onClick={() => setViewMode('by_course')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                viewMode === 'by_course'
                  ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Par Formation</span>
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                viewMode === 'flat'
                  ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tous les fichiers</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2.5 sm:p-3 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
            <FolderDown className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider truncate">Total Fichiers</p>
            <p className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-none mt-0.5">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider truncate">Téléchargés</p>
            <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 leading-none mt-0.5">{downloadedCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2.5 sm:p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider truncate">À Télécharger</p>
            <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 leading-none mt-0.5">{pendingDownloadCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider truncate">Formations</p>
            <p className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 leading-none mt-0.5">{enrolledCoursesList.length}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xs space-y-3 sm:space-y-4">
        <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3">
          {/* Search bar */}
          <div className="relative flex-grow">
            <Search className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un fichier, un module..."
              className="w-full pl-10 pr-9 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Course filter select */}
          <div className="w-full md:w-64">
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full py-2.5 px-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="all">📚 Toutes les formations ({enrolledCoursesList.length})</option>
              {enrolledCoursesList.map(c => (
                <option key={c.id} value={c.id}>
                  {c.initials ? `[${c.initials}] ` : ''}{c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Download status filter */}
          <div className="w-full md:w-56">
            <select
              value={downloadStatusFilter}
              onChange={(e) => setDownloadStatusFilter(e.target.value as any)}
              className="w-full py-2.5 px-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="all">🔍 Tous les états ({allFiles.length})</option>
              <option value="downloaded">✅ Téléchargés ({downloadedCount})</option>
              <option value="not_downloaded">📥 Non téléchargés ({pendingDownloadCount})</option>
            </select>
          </div>
        </div>

        {/* File Type Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-xs font-bold text-gray-400 dark:text-slate-500 shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Type :
          </span>

          {[
            { id: 'all', label: 'Tous' },
            { id: 'pdf', label: 'PDF' },
            { id: 'word', label: 'Word' },
            { id: 'excel', label: 'Excel' },
            { id: 'powerpoint', label: 'PowerPoint' },
            { id: 'image', label: 'Images' },
            { id: 'video', label: 'Vidéo/Audio' },
            { id: 'zip', label: 'Archives' },
          ].map(type => (
            <button
              key={type.id}
              onClick={() => setSelectedCategory(type.id as FileTypeCategory)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === type.id
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200/60 dark:border-slate-700/60 hover:bg-gray-100 dark:hover:bg-slate-750'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content View */}
      {filteredFiles.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-10 text-center border border-gray-100 dark:border-slate-800 shadow-xs max-w-lg mx-auto">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <FolderDown className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1">
            {allFiles.length === 0 ? "Aucun fichier disponible" : "Aucun fichier correspondant"}
          </h3>
          <p className="text-gray-500 dark:text-slate-400 text-xs leading-relaxed mb-5 sm:mb-6">
            {allFiles.length === 0
              ? "Vous n'avez aucun document de cours disponible pour le moment. Inscrivez-vous à des formations pour accéder aux supports téléchargeables."
              : "Essayez de modifier votre recherche ou vos filtres pour afficher vos documents."}
          </p>
          {allFiles.length > 0 && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCourseId('all');
                setSelectedCategory('all');
                setDownloadStatusFilter('all');
              }}
              className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition-colors"
            >
              Réinitialiser tous les filtres
            </button>
          )}
        </div>
      ) : viewMode === 'by_course' ? (
        /* Organisé par Formation */
        <div className="space-y-6 sm:space-y-8">
          {filesByCourse.map(({ courseInfo, files }) => (
            <div key={courseInfo.id} className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-xs">
              {/* Course Header Banner */}
              <div className="p-3.5 sm:p-5 border-b border-gray-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-xs shrink-0">
                    {courseInfo.initials || courseInfo.title?.substring(0, 2).toUpperCase() || 'FC'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white leading-tight truncate">
                      {courseInfo.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {files.length} document{files.length !== 1 ? 's' : ''} disponible{files.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {files.filter(f => downloadedKeys.includes(f.key) || downloadedKeys.includes(f.url)).length} / {files.length} téléchargé(s)
                  </span>
                </div>
              </div>

              {/* Files Grid for this Course */}
              <div className="p-3 sm:p-5 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {files.map(file => (
                  <FileCard
                    key={file.key}
                    file={file}
                    isDownloaded={downloadedKeys.includes(file.key) || downloadedKeys.includes(file.url)}
                    onDownload={() => handleDownload(file)}
                    onToggleStatus={() => toggleDownloadState(file.key, file.url)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Vue Liste Flat */
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFiles.map(file => (
            <FileCard
              key={file.key}
              file={file}
              isDownloaded={downloadedKeys.includes(file.key) || downloadedKeys.includes(file.url)}
              onDownload={() => handleDownload(file)}
              onToggleStatus={() => toggleDownloadState(file.key, file.url)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileCardProps {
  key?: React.Key;
  file: ExtractedFileItem;
  isDownloaded: boolean;
  onDownload: () => void;
  onToggleStatus: () => void;
}

function FileCard({ file, isDownloaded, onDownload, onToggleStatus }: FileCardProps) {
  const meta = getFileTypeMeta(file.name, file.url);
  const IconComponent = meta.icon;
  const isLocked = file.paymentStatus !== 'approved';

  return (
    <div className={`rounded-2xl p-3.5 sm:p-4 border transition-all flex flex-col justify-between h-full group bg-white dark:bg-slate-900 ${
      isLocked
        ? 'border-gray-200 dark:border-slate-800 opacity-80'
        : isDownloaded
          ? 'border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-400 hover:shadow-xs'
          : 'border-gray-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-xs'
    }`}>
      <div>
        {/* Top Badges: File Extension & Downloaded Indicator */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shrink-0 ${meta.badge}`}>
            <IconComponent className="w-3 h-3 shrink-0" />
            <span>{meta.extension}</span>
          </span>

          <button
            onClick={onToggleStatus}
            disabled={isLocked}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all border shrink-0 ${
              isDownloaded
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-200'
            }`}
            title={isDownloaded ? "Cliquer pour marquer comme non téléchargé" : "Cliquer pour marquer comme téléchargé"}
          >
            {isDownloaded ? (
              <>
                <Check className="w-3 h-3 stroke-[3] text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Téléchargé</span>
              </>
            ) : (
              <>
                <Download className="w-3 h-3 shrink-0" />
                <span>Non téléchargé</span>
              </>
            )}
          </button>
        </div>

        {/* File Name */}
        <h4 className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white leading-snug line-clamp-2 break-words group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors mb-2">
          {file.name}
        </h4>

        {/* Course & Module Origin */}
        <div className="bg-slate-50/80 dark:bg-slate-800/50 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800/80 space-y-1 mb-3">
          <p className="text-[11px] font-semibold text-gray-600 dark:text-slate-300 truncate flex items-center gap-1.5">
            <BookOpen className="w-3 h-3 text-purple-500 shrink-0" />
            <span className="truncate">{file.courseTitle}</span>
          </p>
          {file.moduleTitle && (
            <p className="text-[10px] font-medium text-gray-400 dark:text-slate-500 truncate pl-4.5">
              ↳ {file.moduleTitle}
            </p>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2.5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2 mt-auto">
        <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
          {meta.label}
        </span>

        {isLocked ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 shrink-0">
            <Lock className="w-3 h-3" />
            <span>Verrouillé</span>
          </span>
        ) : (
          <button
            onClick={onDownload}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 shrink-0 ${
              isDownloaded
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloaded ? "Ouvrir" : "Télécharger"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
