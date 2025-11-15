"use client";

import React, { useRef, useEffect, useState } from "react";
import { Camera, Video, VideoOff, AlertCircle, Loader2, Check } from "lucide-react";

export interface FaceData {
  box: [number, number, number, number];
  match: { user_id: string; name: string } | null;
  confidence?: number;
  distance?: number;
}

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void;
  captureIntervalMs?: number | null;
  singleShot?: boolean;
  isLiveMode?: boolean;
  facesData?: FaceData[];
}

const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  captureIntervalMs = null,
  singleShot = false,
  isLiveMode = false,
  facesData = [],
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [cameraStatus, setCameraStatus] = useState<"loading" | "active" | "stopped">("stopped");
  const [cameraError, setCameraError] = useState<string>("");
  const [captureCount, setCaptureCount] = useState(0);
  const [lastCaptureTime, setLastCaptureTime] = useState<Date | null>(null);

  const startCamera = async () => {
    try {
      setCameraStatus("loading");
      setCameraError("");
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280, min: 640 }, 
          height: { ideal: 720, min: 480 }, 
          facingMode: "user" 
        },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          setCameraStatus("active");
          if (isLiveMode) {
            startOverlayRendering();
          }
        };
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      let errorMessage = "Failed to access camera.";
      
      if (err.name === "NotAllowedError") {
        errorMessage = "Camera access denied. Please allow camera permissions.";
      } else if (err.name === "NotFoundError") {
        errorMessage = "No camera found on this device.";
      } else if (err.name === "NotReadableError") {
        errorMessage = "Camera is already in use by another application.";
      }
      
      setCameraError(errorMessage);
      setCameraStatus("stopped");
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach((track) => track.stop());
    
    if (videoRef.current) videoRef.current.srcObject = null;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    setCameraStatus("stopped");
    setCaptureCount(0);
  };

  const startOverlayRendering = () => {
    const drawOverlay = () => {
      if (cameraStatus !== "active" || !isLiveMode) return;
      
      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;
      
      if (!video || !overlay) return;
      
      overlay.width = video.videoWidth || 640;
      overlay.height = video.videoHeight || 480;
      const ctx = overlay.getContext("2d");
      
      if (!ctx) return;
      
      // Clear previous overlay
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      
      // Draw face detection boxes and labels
      facesData.forEach((face) => {
        const [x, y, w, h] = face.box;
        const isMatched = face.match !== null;
        
        // Draw rectangle
        ctx.strokeStyle = isMatched ? "#10b981" : "#ef4444"; // green or red
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        
        // Draw corner brackets for modern look
        const cornerLength = 20;
        ctx.lineWidth = 4;
        
        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(x, y + cornerLength);
        ctx.lineTo(x, y);
        ctx.lineTo(x + cornerLength, y);
        ctx.stroke();
        
        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(x + w - cornerLength, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + cornerLength);
        ctx.stroke();
        
        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(x, y + h - cornerLength);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + cornerLength, y + h);
        ctx.stroke();
        
        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(x + w - cornerLength, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w, y + h - cornerLength);
        ctx.stroke();
        
        // Draw label background
        const labelText = isMatched 
          ? `${face.match!.name} (${face.match!.user_id})` 
          : "Unknown";
        
        const confidence = face.confidence 
          ? ` - ${Math.round(face.confidence)}%` 
          : "";
        
        const fullLabel = labelText + confidence;
        
        ctx.font = "bold 16px Arial";
        const textMetrics = ctx.measureText(fullLabel);
        const textWidth = textMetrics.width;
        const textHeight = 24;
        
        // Background for text
        ctx.fillStyle = isMatched 
          ? "rgba(16, 185, 129, 0.9)" 
          : "rgba(239, 68, 68, 0.9)";
        ctx.fillRect(x, y - textHeight - 8, textWidth + 16, textHeight + 8);
        
        // Draw text
        ctx.fillStyle = "white";
        ctx.fillText(fullLabel, x + 8, y - 12);
        
        // Draw checkmark or X icon
        if (isMatched) {
          ctx.fillStyle = "#10b981";
          ctx.beginPath();
          ctx.arc(x + w - 15, y + 15, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + w - 19, y + 15);
          ctx.lineTo(x + w - 15, y + 19);
          ctx.lineTo(x + w - 10, y + 11);
          ctx.stroke();
        }
      });
      
      animationFrameRef.current = requestAnimationFrame(drawOverlay);
    };
    
    drawOverlay();
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || cameraStatus !== "active") return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw face detection overlays on the captured image
    facesData.forEach((face) => {
      const [x, y, w, h] = face.box;
      const isMatched = face.match !== null;
      
      ctx.strokeStyle = isMatched ? "#10b981" : "#ef4444";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      const labelText = isMatched 
        ? `${face.match!.name} (${face.match!.user_id})` 
        : "Unknown";
      
      ctx.font = "bold 16px Arial";
      const textMetrics = ctx.measureText(labelText);
      
      // Background
      ctx.fillStyle = isMatched 
        ? "rgba(16, 185, 129, 0.9)" 
        : "rgba(239, 68, 68, 0.9)";
      ctx.fillRect(x, y - 28, textMetrics.width + 16, 28);
      
      // Text
      ctx.fillStyle = "white";
      ctx.fillText(labelText, x + 8, y - 8);
    });

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onCapture(dataUrl);
    setCaptureCount(prev => prev + 1);
    setLastCaptureTime(new Date());
  };

  // Start camera on mount if needed
  useEffect(() => {
    if (singleShot || isLiveMode) {
      startCamera();
    }
    return () => stopCamera();
  }, [singleShot, isLiveMode]);

  // Handle auto-capture interval
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    if (captureIntervalMs && isLiveMode && cameraStatus === "active") {
      intervalRef.current = setInterval(capture, captureIntervalMs);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [captureIntervalMs, isLiveMode, cameraStatus, facesData]);

  // Update overlay when faces change
  useEffect(() => {
    if (isLiveMode && cameraStatus === "active") {
      startOverlayRendering();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [facesData, isLiveMode, cameraStatus]);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Camera Feed Container */}
      <div className="relative bg-slate-900 rounded-2xl overflow-hidden shadow-2xl">
        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`w-full object-cover transition-opacity duration-300 ${
            cameraStatus === "active" ? "opacity-100" : "opacity-0"
          }`}
          style={{ maxHeight: "600px" }}
        />
        
        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Overlay canvas for live face detection */}
        {isLiveMode && (
          <canvas 
            ref={overlayCanvasRef} 
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
        )}

        {/* Loading State */}
        {cameraStatus === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
            <p className="text-white font-semibold text-lg">Starting camera...</p>
            <p className="text-slate-400 text-sm mt-2">Please allow camera access</p>
          </div>
        )}

        {/* Stopped State */}
        {cameraStatus === "stopped" && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
              <div className="bg-blue-500 rounded-full p-4 inline-block mb-4">
                <Camera className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-white font-bold text-xl mb-2">Camera Ready</h3>
              <p className="text-slate-300 mb-6">Click below to start the camera</p>
              <button
                onClick={startCamera}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center gap-2 mx-auto"
              >
                <Video className="w-5 h-5" />
                Start Camera
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-red-900 to-slate-900">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center max-w-md">
              <div className="bg-red-500 rounded-full p-4 inline-block mb-4">
                <AlertCircle className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-white font-bold text-xl mb-2">Camera Error</h3>
              <p className="text-red-200 mb-6">{cameraError}</p>
              <button
                onClick={startCamera}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Status Bar */}
        {cameraStatus === "active" && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="font-semibold">Live</span>
                </div>
                {facesData.length > 0 && (
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium">
                      {facesData.filter(f => f.match).length} / {facesData.length} recognized
                    </span>
                  </div>
                )}
              </div>
              {captureCount > 0 && (
                <div className="text-sm">
                  <span className="font-semibold">{captureCount}</span> captures
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {cameraStatus === "active" && (
        <div className="mt-4 flex gap-3">
          {singleShot && (
            <button
              onClick={capture}
              className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Capture Photo
            </button>
          )}
          <button
            onClick={stopCamera}
            className="px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all duration-300 shadow-lg flex items-center gap-2"
          >
            <VideoOff className="w-5 h-5" />
            Stop Camera
          </button>
        </div>
      )}

      {/* Info Panel */}
      {isLiveMode && captureIntervalMs && cameraStatus === "active" && (
        <div className="mt-4 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-900 mb-2">
            <Camera className="w-5 h-5" />
            <h4 className="font-bold">Live Capture Mode</h4>
          </div>
          <p className="text-sm text-blue-800">
            Automatically capturing every {captureIntervalMs / 1000} seconds
          </p>
          {lastCaptureTime && (
            <p className="text-xs text-blue-700 mt-1">
              Last capture: {lastCaptureTime.toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CameraCapture;