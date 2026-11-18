import {
  FileArchive,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  LayoutGrid,
  Presentation,
  File as GenericFile,
} from 'lucide-react';
import type { DriveFile } from '../types/drive';
import { getFileCategory, isFolder } from '../lib/organizer';

interface FileTypeIconProps {
  file: DriveFile;
  className?: string;
}

export function FileTypeIcon({ file, className = 'w-4 h-4' }: FileTypeIconProps) {
  if (isFolder(file)) {
    return (
      <Folder
        className={`${className} text-blue-700 dark:text-blue-400 shrink-0`}
        aria-hidden="true"
      />
    );
  }

  const category = getFileCategory(file);
  switch (category) {
    case 'documents':
      return (
        <FileText
          className={`${className} text-blue-600 dark:text-blue-400 shrink-0`}
          aria-hidden="true"
        />
      );
    case 'pdf':
      return (
        <FileText
          className={`${className} text-red-600 dark:text-red-400 shrink-0`}
          aria-hidden="true"
        />
      );
    case 'spreadsheets':
      return (
        <FileSpreadsheet
          className={`${className} text-emerald-600 dark:text-emerald-400 shrink-0`}
          aria-hidden="true"
        />
      );
    case 'presentations':
      return (
        <Presentation
          className={`${className} text-amber-600 dark:text-amber-400 shrink-0`}
          aria-hidden="true"
        />
      );
    case 'images':
      return (
        <FileImage
          className={`${className} text-slate-600 dark:text-slate-400 shrink-0`}
          aria-hidden="true"
        />
      );
    case 'media':
      return (
        <FileVideo
          className={`${className} text-slate-600 dark:text-slate-400 shrink-0`}
          aria-hidden="true"
        />
      );
    case 'archives':
      return (
        <FileArchive
          className={`${className} text-amber-700 dark:text-amber-400 shrink-0`}
          aria-hidden="true"
        />
      );
    case 'code':
      return (
        <FileCode2
          className={`${className} text-slate-700 dark:text-slate-300 shrink-0`}
          aria-hidden="true"
        />
      );
    case 'forms':
      return (
        <LayoutGrid
          className={`${className} text-blue-700 dark:text-blue-400 shrink-0`}
          aria-hidden="true"
        />
      );
    default:
      return (
        <GenericFile
          className={`${className} text-slate-500 dark:text-slate-400 shrink-0`}
          aria-hidden="true"
        />
      );
  }
}
