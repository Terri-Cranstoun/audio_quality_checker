import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, Typography, Paper, CircularProgress } from '@mui/material';
import WaveSurfer from 'wavesurfer.js';

interface AudioQualityMetrics {
  bitrate: number;
  sampleRate: number;
  channels: number;
  duration: number;
  qualityScore: number;
}

const AudioQualityChecker: React.FC = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [metrics, setMetrics] = useState<AudioQualityMetrics | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (waveformRef.current && audioUrl) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#4a90e2',
        progressColor: '#2c5282',
        cursorColor: '#2c5282',
        barWidth: 2,
        barRadius: 3,
        height: 100,
      });

      wavesurferRef.current.load(audioUrl);

      return () => {
        wavesurferRef.current?.destroy();
      };
    }
  }, [audioUrl]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setMetrics(null);
    }
  };

  const analyzeAudioQuality = async () => {
    if (!audioFile) return;

    setIsAnalyzing(true);

    // Create an AudioContext to analyze the audio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Calculate quality metrics
    const qualityScore = calculateQualityScore(audioBuffer);
    
    setMetrics({
      bitrate: Math.round((audioFile.size / audioBuffer.duration) * 8 / 1000), // kbps
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      duration: audioBuffer.duration,
      qualityScore,
    });

    setIsAnalyzing(false);
    audioContext.close();
  };

  const calculateQualityScore = (audioBuffer: AudioBuffer): number => {
    // Quality score calculation based on sample rate and channels
    const baseScore = 50;
    const sampleRateScore = (audioBuffer.sampleRate / 44100) * 25;
    const channelsScore = audioBuffer.numberOfChannels * 12.5;
    return Math.min(100, baseScore + sampleRateScore + channelsScore);
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Audio Quality Checker
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            component="label"
            sx={{ mr: 2 }}
          >
            Upload Audio File
            <input
              type="file"
              hidden
              accept="audio/*"
              onChange={handleFileUpload}
            />
          </Button>

          {audioFile && (
            <Button
              variant="contained"
              color="primary"
              onClick={analyzeAudioQuality}
              disabled={isAnalyzing}
            >
              Analyze Quality
            </Button>
          )}
        </Box>

        {audioFile && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Selected file: {audioFile.name}
            </Typography>
            <div ref={waveformRef} />
          </Box>
        )}

        {isAnalyzing && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography>Analyzing audio quality...</Typography>
          </Box>
        )}

        {metrics && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Quality Analysis Results
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Typography>Bitrate: {metrics.bitrate} kbps</Typography>
              <Typography>Sample Rate: {metrics.sampleRate} Hz</Typography>
              <Typography>Channels: {metrics.channels}</Typography>
              <Typography>Duration: {metrics.duration.toFixed(2)} seconds</Typography>
              <Typography>Quality Score: {metrics.qualityScore.toFixed(1)}/100</Typography>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default AudioQualityChecker; 