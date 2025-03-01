import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import {
  Users,
  Link2,
  Signal,
  Clock,
  Activity,
  Wifi,
  CheckCircle2,
  Power,
  AlertTriangle,
  Shield,
  Zap
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PeerConnection as PeerConnectionType } from '../types';
import { toast } from 'react-hot-toast';
import peerService from '../utils/peerService';

interface Props {
  peerId: string;
  username: string;
  onConnect: (remotePeerId: string) => void;
  isConnecting: boolean;
  connectedPeers: PeerConnectionType[];
}

const MotionCard = motion(Card);

export default function PeerConnection({ peerId, username, onConnect, isConnecting, connectedPeers }: Props) {
  const [remotePeerId, setRemotePeerId] = useState('');
  const [copied, setCopied] = useState(false);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (remotePeerId.trim()) {
      onConnect(remotePeerId.trim());
      setRemotePeerId('');
    }
  };

  const copyId = async () => {
    await navigator.clipboard.writeText(peerId);
    setCopied(true);
    toast.success('ID copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = (peerId: string) => {
    peerService.disconnect(peerId);
    toast.success('Peer disconnected');
  };

  return (
    <div className="space-y-6">
      <MotionCard
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-50 to-white border-slate-100"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-500" />
            Your Connection Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input 
              value={peerId}
              readOnly
              className="font-mono bg-slate-50 border-slate-200"
            />
            <Button 
              variant="outline"
              onClick={copyId}
              className={`relative flex items-center gap-2 transition-all duration-300 ${
                copied ? 'bg-green-50 text-green-600 border-green-200' : ''
              }`}
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 animate-scale-check" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Copy ID'}
            </Button>
          </div>
        </CardContent>
      </MotionCard>

      <MotionCard
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-50 to-white border-slate-100"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Quick Connect
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="flex gap-4">
            <Input
              value={remotePeerId}
              onChange={(e) => setRemotePeerId(e.target.value)}
              placeholder="Enter peer ID"
              className="font-mono"
            />
            <Button 
              type="submit"
              disabled={isConnecting || !remotePeerId.trim()}
              className="min-w-[120px] bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
            >
              {isConnecting ? (
                <>
                  <span className="animate-spin mr-2">⭮</span>
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </MotionCard>

      {connectedPeers.length > 0 && (
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-50 to-white border-slate-100"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Signal className="h-5 w-5 text-emerald-500" />
              Active Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {connectedPeers.map((peer) => (
                <motion.div 
                  key={peer.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50 transition-all duration-200 hover:shadow-lg"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="h-5 w-5 text-indigo-500" />
                    <span className="font-medium">{peer.username}</span>
                    <div className="flex items-center gap-2 ml-auto">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className={`relative flex h-2.5 w-2.5 mr-2 ${
                              peer.connectionStatus === 'connected' ? 'animate-pulse-fast' : ''
                            }`}>
                              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                peer.connectionStatus === 'connected' ? 'bg-emerald-400' :
                                peer.connectionStatus === 'connecting' ? 'bg-amber-400' :
                                'bg-red-400'
                              }`} />
                              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                peer.connectionStatus === 'connected' ? 'bg-emerald-500' :
                                peer.connectionStatus === 'connecting' ? 'bg-amber-500' :
                                'bg-red-500'
                              }`} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{peer.connectionStatus}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(peer.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span className="text-slate-500">Connected:</span>
                          <span className="font-medium text-slate-700">
                            {peer.connectedAt?.toLocaleTimeString()}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Connection time</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-2">
                          <Signal className="h-4 w-4 text-purple-500" />
                          <span className="text-slate-500">Channel:</span>
                          <span className="font-medium text-slate-700">
                            {peer.dataChannelState || 'closed'}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>WebRTC data channel state</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {peer.connectionStatus !== 'connected' && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <span className="text-slate-500">Status:</span>
                            <span className="font-medium text-slate-700">
                              Reconnecting...
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Attempting to restore connection</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </MotionCard>
      )}
    </div>
  );
}