
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
  const [statusMessage, setStatusMessage] = useState("Initializing Optical Modules...");

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
    setStatusMessage("Requesting Camera Permission...");
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
            setStatusMessage("Feed Active");
          }).catch(() => {
            setError("Playback failed. Please interact with the page and retry.");
          });
        };
      }
    } catch (err: any) {
      setError("Hardware access denied. Please enable camera permissions in your browser settings.");
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
    <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500 max-w-2xl mx-auto w-full px-4">
      <div className="w-full aspect-[4/3] bg-slate-950 rounded-[2rem] overflow-hidden relative border-4 border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center group">
        
        {/* Scanning Laser Animation */}
        {cameraReady && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_15px_rgba(59,130,246,0.8)] absolute animate-scan-line"></div>
          </div>
        )}

        {!cameraReady && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-30">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-mono text-xs uppercase tracking-[0.2em]">{statusMessage}</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900/95 z-40 backdrop-blur-md">
            <div className="bg-rose-500/10 p-4 rounded-full mb-4">
              <i className="fas fa-video-slash text-rose-500 text-3xl"></i>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Sensor Error</h3>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">{error}</p>
            <button 
              onClick={startCamera} 
              className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-slate-700"
            >
              Retry Connection
            </button>
          </div>
        )}

        <video 
          ref={videoRef} 
          className={`w-full h-full object-cover transition-opacity duration-700 ${cameraReady ? 'opacity-100' : 'opacity-0'}`} 
          autoPlay 
          muted 
          playsInline 
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Viewfinder Overlay */}
        {cameraReady && (
          <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
             <div className="w-2/3 aspect-square border-2 border-white/10 rounded-3xl relative">
                <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl"></div>
                <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl"></div>
                <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl"></div>
                <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-blue-500 rounded-br-2xl"></div>
                
                {/* Visual noise/grid effect */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
             </div>
          </div>
        )}
      </div>

      <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full">
        <button 
          onClick={onCancel} 
          className="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all border border-slate-700"
        >
          Abort Scan
        </button>
        <button 
          onClick={handleCapture}
          disabled={!cameraReady || isCapturing}
          className="flex-1 w-full px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-[0_10px_30px_rgba(37,99,235,0.3)] flex items-center justify-center space-x-3 disabled:opacity-50 group active:scale-[0.98]"
        >
          <i className="fas fa-fingerprint text-xl group-hover:scale-110 transition-transform"></i>
          <span>Initialize Forensic AI Scan</span>
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan-line {
          0% { top: 0%; opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 3s linear infinite;
        }
      `}} />
    </div>
  );
};

export default Scanner;
