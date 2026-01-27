
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
  const [statusMessage, setStatusMessage] = useState("Accessing camera hardware...");

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
    setStatusMessage("Requesting permissions...");
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        setStatusMessage("Connecting stream...");
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setCameraReady(true);
            setStatusMessage("Camera active");
          }).catch(() => {
            setError("Click the preview to start the video feed.");
          });
        };
      }
    } catch (err: any) {
      setError("Camera access denied or unavailable.");
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

      if (code && code.data) {
        stopCamera();
        onScan(code.data);
      } else {
        // INSTEAD of failing, we offer to send the image to AI
        stopCamera();
        onDeepScan(base64);
      }
    }
  };

  return (
    <div className="flex flex-col items-center animate-in fade-in duration-500 max-w-2xl mx-auto w-full px-4">
      <div className="w-full aspect-[16/9] bg-slate-950 rounded-3xl overflow-hidden relative border-2 border-slate-700 shadow-2xl flex items-center justify-center">
        {!cameraReady && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20">
            <div className="w-16 h-16 relative mb-4">
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-400 font-bold tracking-widest text-xs uppercase animate-pulse">{statusMessage}</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/80 z-30 backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-2">Camera Notice</h3>
            <p className="text-sm text-slate-300 mb-6">{error}</p>
            <button onClick={startCamera} className="px-8 py-3 bg-blue-600 rounded-xl font-bold">Restart</button>
          </div>
        )}

        <video ref={videoRef} className={`w-full h-full object-cover ${cameraReady ? 'opacity-100' : 'opacity-0'}`} autoPlay muted playsInline />
        <canvas ref={canvasRef} className="hidden" />

        {cameraReady && (
          <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
             <div className="w-1/2 aspect-square border-2 border-blue-500/40 rounded-3xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg -mt-1 -ml-1"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg -mt-1 -mr-1"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg -mb-1 -ml-1"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg -mb-1 -mr-1"></div>
             </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full">
        <button onClick={onCancel} className="w-full sm:w-auto px-10 py-4 bg-slate-800 rounded-2xl font-bold">Cancel</button>
        <button 
          onClick={handleCapture}
          disabled={!cameraReady || isCapturing}
          className="flex-1 w-full px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center space-x-3 disabled:opacity-50"
        >
          <i className="fas fa-search-plus text-xl"></i>
          <span>Analyze Frame with AI</span>
        </button>
      </div>
    </div>
  );
};

export default Scanner;
