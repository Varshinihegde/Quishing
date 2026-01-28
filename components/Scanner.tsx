
import React, { useRef, useEffect, useState, useCallback } from 'react';
import jsQR from 'jsqr';

interface ScannerProps {
  onScan: (content: string) => void;
  onDeepScan: (base64: string) => void;
  onCancel: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onDeepScan, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Initializing Sensors...");

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setCameraReady(false);
    setStatusMessage("Requesting Hardware Access...");
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setCameraReady(true);
            setStatusMessage("Feed Operational");
          }).catch(() => {
            setError("Playback blocked by browser policy.");
          });
        };
      }
    } catch (err: any) {
      setError("Camera access denied. Please verify system permissions.");
      setCameraReady(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    setIsCapturing(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      const base64 = canvas.toDataURL('image/png');

      stopCamera();
      if (code && code.data) {
        onScan(code.data);
      } else {
        onDeepScan(base64);
      }
    }
  };

  return (
    <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-700 max-w-3xl mx-auto w-full px-4">
      <div className="w-full aspect-video bg-slate-950 rounded-[3rem] overflow-hidden relative border-8 border-slate-800 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] flex items-center justify-center group">
        
        {/* Scanning Laser Animation */}
        {cameraReady && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_20px_rgba(59,130,246,1)] absolute animate-scan-line"></div>
          </div>
        )}

        {!cameraReady && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 z-30 backdrop-blur-sm">
            <div className="w-14 h-14 border-[3px] border-blue-500/10 border-t-blue-500 rounded-full animate-spin mb-6"></div>
            <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.4em] font-black">{statusMessage}</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-slate-900/98 z-40 backdrop-blur-xl">
            <div className="bg-rose-500/10 p-6 rounded-3xl mb-6">
              <i className="fas fa-video-slash text-rose-500 text-4xl"></i>
            </div>
            <h3 className="text-3xl font-black text-white mb-4 italic uppercase tracking-tighter">Sensor Error</h3>
            <p className="text-sm text-slate-400 mb-10 leading-relaxed font-medium">{error}</p>
            <button 
              onClick={startCamera} 
              className="px-10 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest transition-all border border-slate-700 active:scale-95"
            >
              Retry Handshake
            </button>
          </div>
        )}

        <video 
          ref={videoRef} 
          className={`w-full h-full object-cover transition-opacity duration-1000 ${cameraReady ? 'opacity-100' : 'opacity-0'}`} 
          autoPlay 
          muted 
          playsInline 
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* HUD Viewfinder Overlay */}
        {cameraReady && (
          <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center p-10">
             <div className="w-full h-full border-[1px] border-white/5 rounded-[2rem] relative">
                <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-blue-600 rounded-tl-[1.5rem] shadow-[-4px_-4px_10px_rgba(37,99,235,0.2)]"></div>
                <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-blue-600 rounded-tr-[1.5rem] shadow-[4px_-4px_10px_rgba(37,99,235,0.2)]"></div>
                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-blue-600 rounded-bl-[1.5rem] shadow-[-4px_4px_10px_rgba(37,99,235,0.2)]"></div>
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-blue-600 rounded-br-[1.5rem] shadow-[4px_4px_10px_rgba(37,99,235,0.2)]"></div>
                
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 opacity-20 border border-white rounded-full"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]"></div>
             </div>
          </div>
        )}
      </div>

      <div className="mt-12 flex flex-col sm:flex-row items-center gap-6 w-full">
        <button 
          onClick={onCancel} 
          className="w-full sm:w-auto px-10 py-5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-3xl font-black uppercase tracking-widest text-xs transition-all border border-slate-700"
        >
          Cancel
        </button>
        <button 
          onClick={handleCapture}
          disabled={!cameraReady || isCapturing}
          className="flex-1 w-full px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase tracking-widest text-xs transition-all shadow-2xl shadow-blue-600/20 flex items-center justify-center space-x-4 disabled:opacity-50 group active:scale-[0.97]"
        >
          <i className="fas fa-microchip text-xl group-hover:rotate-12 transition-transform"></i>
          <span>Capture and Run Forensics</span>
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan-line {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 2.5s linear infinite;
        }
      `}} />
    </div>
  );
};

export default Scanner;
