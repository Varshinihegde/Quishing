
import React, { useRef, useEffect, useState, useCallback } from 'react';
import jsQR from 'jsqr';

interface ScannerProps {
  onScan: (content: string) => void;
  onCancel: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onCancel }) => {
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
      // Constraints optimized for QR scanning
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 1.7777777778 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        setStatusMessage("Connecting stream...");
        videoRef.current.srcObject = stream;
        
        // Critical attributes for mobile and modern browser autoplay policies
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        
        // Wait for the video to be ready to play
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setCameraReady(true);
            setStatusMessage("Camera active");
          }).catch(e => {
            console.error("Autoplay failed:", e);
            setError("Click the preview to start the video feed.");
          });
        };
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      let msg = "Camera access denied or unavailable.";
      if (err.name === 'NotAllowedError') msg = "Permission denied. Please allow camera access in your browser settings.";
      if (err.name === 'NotFoundError') msg = "No camera detected on this device.";
      if (err.name === 'NotReadableError') msg = "Camera is already in use by another application.";
      
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        msg = "Security Error: Camera access requires HTTPS or localhost.";
      }
      setError(msg);
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
      // Sync canvas dimensions with actual video feed
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw frame
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Decode locally (as specified, mimicking the "backend decoding" logic client-side)
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        stopCamera();
        onScan(code.data);
      } else {
        setError("Could not detect a QR code. Try moving closer or adjusting lighting.");
        setIsCapturing(false);
        // Clear local error message after delay
        setTimeout(() => {
          if (!isCapturing) setError(null);
        }, 3000);
      }
    }
  };

  return (
    <div className="flex flex-col items-center animate-in fade-in duration-500 max-w-2xl mx-auto w-full px-4">
      <div className="w-full aspect-[16/9] bg-slate-950 rounded-3xl overflow-hidden relative border-2 border-slate-700 shadow-2xl flex items-center justify-center">
        
        {/* Loading UI */}
        {!cameraReady && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20">
            <div className="w-16 h-16 relative mb-4">
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-400 font-bold tracking-widest text-xs uppercase animate-pulse">{statusMessage}</p>
          </div>
        )}

        {/* Error / Feedback UI */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/80 z-30 backdrop-blur-sm transition-all duration-300">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4 border border-rose-500/20">
               <i className="fas fa-exclamation-triangle text-2xl text-rose-500"></i>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Notice</h3>
            <p className="text-sm text-slate-300 leading-relaxed max-w-[300px]">{error}</p>
            {!cameraReady && (
              <button 
                onClick={startCamera}
                className="mt-6 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-600/20 active:scale-95"
              >
                Restart Camera
              </button>
            )}
          </div>
        )}

        {/* The Live Video Feed */}
        <video 
          ref={videoRef} 
          className={`w-full h-full object-cover transition-opacity duration-700 ${cameraReady ? 'opacity-100' : 'opacity-0'}`}
          autoPlay
          muted 
          playsInline 
          onClick={() => videoRef.current?.play()} // Fallback manual trigger
        />
        
        <canvas ref={canvasRef} className="hidden" />

        {/* Viewfinder UI */}
        {cameraReady && (
          <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
             <div className="w-1/2 aspect-square border-2 border-blue-500/40 rounded-3xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg -mt-1 -ml-1"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg -mt-1 -mr-1"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg -mb-1 -ml-1"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg -mb-1 -mr-1"></div>
                
                <div className="absolute inset-x-0 h-0.5 bg-blue-400/30 animate-pulse top-1/2"></div>
             </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full">
        <button 
          onClick={onCancel}
          className="w-full sm:w-auto px-10 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all border border-slate-700 font-bold active:scale-95 shadow-lg"
        >
          Close Scanner
        </button>
        <button 
          onClick={handleCapture}
          disabled={!cameraReady || isCapturing}
          className={`flex-1 w-full px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20 active:scale-95 flex items-center justify-center space-x-3 ${(!cameraReady || isCapturing) ? 'opacity-50 cursor-not-allowed shadow-none' : ''}`}
        >
          {isCapturing ? (
            <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <i className="fas fa-qrcode text-xl"></i>
              <span>Capture & Scan QR</span>
            </>
          )}
        </button>
      </div>

      <div className="mt-6 text-slate-500 flex items-center space-x-2">
        <i className="fas fa-shield-alt text-[10px]"></i>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">End-to-End Secure Frame Analysis</p>
      </div>
    </div>
  );
};

export default Scanner;
