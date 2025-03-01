import React from 'react';
import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  File,
} from 'lucide-react';

type FileIconProps = {
  filename: string;
  size?: number;
  className?: string;
};

export function FileIcon({ filename, size = 24, className = '' }: FileIconProps) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const getIcon = () => {
    const iconProps = { size, className };

    switch (true) {
      case /^(jpg|jpeg|png|gif|bmp|webp|svg)$/.test(ext):
        return <FileImage {...iconProps} />;
      case /^(mp4|webm|avi|mov|wmv|flv|mkv)$/.test(ext):
        return <FileVideo {...iconProps} />;
      case /^(mp3|wav|ogg|m4a|aac)$/.test(ext):
        return <FileAudio {...iconProps} />;
      case /^(zip|rar|7z|tar|gz)$/.test(ext):
        return <FileArchive {...iconProps} />;
      case /^(js|ts|jsx|tsx|py|java|cpp|c|cs|php|html|css|json)$/.test(ext):
        return <FileCode {...iconProps} />;
      case /^(txt|doc|docx|pdf|md|rtf)$/.test(ext):
        return <FileText {...iconProps} />;
      default:
        return <File {...iconProps} />;
    }
  };

  return getIcon();
}
