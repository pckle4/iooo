import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileIcon } from '@/components/ui/file-icon';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Download,
  Send,
  ChevronDown,
  FileText,
  CheckCircle,
  X,
  Trash2,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from '@/components/ui/button';
import { PeerConnection, FileTransfer } from '../types';
import peerService from '../utils/peerService';
import { toast } from 'react-hot-toast';

interface Props {
  connectedPeers: PeerConnection[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

const MotionCard = motion(Card);
const MotionButton = motion(Button);

const removeFile = (fileId: string) => {
  peerService.removeFile(fileId);
  toast.success('File removed');
};

const handleDownload = async (transfer: FileTransfer) => {
  try {
    await peerService.downloadFile(transfer.id);
    toast.success('Download started');
  } catch (error) {
    toast.error(`Download failed: ${(error as Error).message}`);
  }
};

export default function TransferContainer({ connectedPeers }: Props) {
  const [selectedPeers, setSelectedPeers] = useState<Set<string>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);

  useEffect(() => {
    const loadTransfers = () => {
      const transfers: FileTransfer[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('transfer_')) {
          const transfer = JSON.parse(localStorage.getItem(key) || '');
          transfers.push(transfer);
        }
      }
      setTransfers(transfers);
    };

    peerService.onFileTransfer((transfer) => {
      setTransfers(prev => {
        const index = prev.findIndex(t => t.id === transfer.id);
        if (index === -1) return [...prev, transfer];
        const newTransfers = [...prev];
        newTransfers[index] = transfer;
        return newTransfers;
      });
    });

    loadTransfers();
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setPendingFiles(prev => [...prev, ...acceptedFiles]);
    toast.success(`${acceptedFiles.length} file(s) added`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: pendingFiles.length > 0
  });

  const togglePeerSelection = (peerId: string) => {
    const newSelection = new Set(selectedPeers);
    if (newSelection.has(peerId)) {
      newSelection.delete(peerId);
    } else {
      newSelection.add(peerId);
    }
    setSelectedPeers(newSelection);
  };

  const sendFiles = async () => {
    if (selectedPeers.size === 0) {
      toast.error('Please select at least one peer');
      return;
    }

    if (pendingFiles.length === 0) {
      toast.error('No files selected');
      return;
    }

    try {
      for (const peerId of selectedPeers) {
        for (const file of pendingFiles) {
          await peerService.sendFile(file, peerId);
        }
      }
      toast.success('Files sent successfully!');
      setPendingFiles([]);
      setSelectedPeers(new Set());
    } catch (error) {
      toast.error(`Failed to send files: ${(error as Error).message}`);
    }
  };

  const FileMetadata = ({ file }: { file: File }) => (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-sm grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded"
    >
      <span className="text-slate-500">Last Modified:</span>
      <span className="text-slate-700">{new Date(file.lastModified).toLocaleString()}</span>

      <span className="text-slate-500">Size:</span>
      <span className="text-slate-700">{formatBytes(file.size)}</span>

      <span className="text-slate-500">Type:</span>
      <span className="text-slate-700">{file.type || 'application/octet-stream'}</span>
    </motion.div>
  );

  return (
    <div className="mt-8 space-y-8">
      <AnimatePresence>
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-50 to-white border-slate-100"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary/80" />
              Send Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div className="mb-4">
              <h3 className="text-sm font-medium text-slate-700 mb-2">Select Recipients:</h3>
              <div className="flex flex-wrap gap-2">
                {connectedPeers.map(peer => (
                  <MotionButton
                    key={peer.id}
                    variant={selectedPeers.has(peer.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => togglePeerSelection(peer.id)}
                    className="flex items-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {peer.username}
                    <motion.span
                      className={`h-2 w-2 rounded-full ${
                        peer.connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      animate={{
                        scale: peer.connectionStatus === 'connected' ? [1, 1.2, 1] : 1,
                      }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                  </MotionButton>
                ))}
              </div>
            </motion.div>

            <motion.div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
                ${isDragActive ? 'border-primary/60 bg-primary/5 scale-102' : 'border-slate-200'}
                ${pendingFiles.length > 0 ? 'opacity-50' : 'hover:border-slate-300'}
              `}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-medium text-slate-700">
                {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
              </p>
            </motion.div>

            <AnimatePresence>
              {pendingFiles.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-slate-700">Selected Files:</h3>
                    <MotionButton
                      onClick={sendFiles}
                      className="flex items-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Send className="h-4 w-4" />
                      Send to {selectedPeers.size} peer{selectedPeers.size !== 1 ? 's' : ''}
                    </MotionButton>
                  </div>

                  <motion.div layout className="space-y-2">
                    {pendingFiles.map((file, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="bg-white p-4 rounded-lg border border-slate-200 hover:shadow-md transition-shadow group"
                      >
                        <div className="flex items-center gap-3">
                          <FileIcon filename={file.name} />
                          <div className="flex-1">
                            <div className="font-medium text-slate-700">{file.name}</div>
                            <div className="text-sm text-slate-500">{formatBytes(file.size)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <FileText className="h-4 w-4 mr-1" />
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2">
                                <FileMetadata file={file} />
                              </CollapsibleContent>
                            </Collapsible>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setPendingFiles(files => files.filter((_, i) => i !== index));
                                toast.success('File removed from queue');
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </MotionCard>

        {transfers.filter(t => t.status === 'completed').length > 0 && (
          <MotionCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-50 to-white border-slate-100"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary/80" />
                Received Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div layout className="space-y-3">
                <AnimatePresence>
                  {transfers
                    .filter(t => t.status === 'completed')
                    .map(transfer => (
                      <motion.div
                        key={transfer.id}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="bg-white p-4 rounded-lg border border-slate-200 hover:shadow-md transition-shadow relative group"
                      >
                        <div className="flex items-center gap-3">
                          <FileIcon filename={transfer.filename} />
                          <div className="flex-1">
                            <div className="font-medium text-slate-700">{transfer.filename}</div>
                            <div className="text-sm text-slate-500">{formatBytes(transfer.size)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => handleDownload(transfer)}
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </Button>
                            </motion.div>
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => removeFile(transfer.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </motion.div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </AnimatePresence>
              </motion.div>
            </CardContent>
          </MotionCard>
        )}
      </AnimatePresence>
    </div>
  );
}