import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Share2 } from 'lucide-react';
import PeerConnection from './components/PeerConnection';
import TransferContainer from './components/TransferContainer';
import peerService from './utils/peerService';
import { PeerConnection as PeerConnectionType, User } from './types';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectedPeers, setConnectedPeers] = useState<PeerConnectionType[]>([]);

  useEffect(() => {
    const initializePeer = async () => {
      try {
        const user = await peerService.initialize();
        setCurrentUser(user);
        setIsInitializing(false);
        
        peerService.onConnection((id, username, connected) => {
          if (connected) {
            toast.success(`Connected to ${username}!`);
            setIsConnecting(false);
          } else {
            toast.error(`Disconnected from ${username}`);
          }
        });
        
        peerService.onPeersUpdate((peers) => {
          setConnectedPeers(peers);
        });
        
        peerService.onError((error) => {
          toast.error(`Error: ${error.message}`);
          setIsConnecting(false);
        });
      } catch (error) {
        toast.error(`Failed to initialize: ${(error as Error).message}`);
        setIsInitializing(false);
      }
    };

    initializePeer();

    return () => {
      peerService.disconnect();
    };
  }, []);

  const handleConnect = async (remotePeerId: string) => {
    if (remotePeerId === currentUser?.id) {
      toast.error("You can't connect to yourself!");
      return;
    }
    
    setIsConnecting(true);
    
    try {
      await peerService.connect(remotePeerId);
      // Connection status will be updated by the onConnection callback
    } catch (error) {
      toast.error(`Connection failed: ${(error as Error).message}`);
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-purple-50">
      <Toaster position="top-right" />
      
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center">
            <Share2 className="h-8 w-8 text-white mr-3" />
            <h1 className="text-2xl font-bold text-white">P2P File Transfer</h1>
          </div>
          {currentUser && (
            <div className="bg-white/20 backdrop-blur-sm text-white text-sm font-medium px-4 py-1.5 rounded-full border border-white/30">
              {currentUser.username}
            </div>
          )}
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {isInitializing ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-indigo-800">Initializing connection...</p>
          </div>
        ) : (
          <>
            <PeerConnection 
              peerId={currentUser?.id || ''}
              username={currentUser?.username || ''}
              onConnect={handleConnect}
              isConnecting={isConnecting}
              connectedPeers={connectedPeers}
            />
            
            <TransferContainer 
              connectedPeers={connectedPeers}
            />
          </>
        )}
      </main>
      
      <footer className="bg-gradient-to-r from-indigo-800 to-purple-800 mt-12 text-white">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-sm">
            Secure P2P File Transfer - Your files never touch a server
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
