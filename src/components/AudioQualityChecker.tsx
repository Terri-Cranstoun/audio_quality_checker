import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, Typography, Paper, CircularProgress, Fade } from '@mui/material';
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
    <Paper 
      elevation={6} 
      sx={{ 
        p: 4,
        maxWidth: 800,
        width: '100%',
        borderRadius: '24px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      }}
    >
      <Typography 
        variant="h4" 
        gutterBottom 
        sx={{ 
          textAlign: 'center',
          mb: 4,
          fontWeight: 'bold',
          color: '#2c5282',
        }}
      >
        Audio Quality Checker
      </Typography>

      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Button
          variant="contained"
          component="label"
          sx={{ 
            mr: 2,
            borderRadius: '12px',
            px: 4,
            py: 1.5,
            fontSize: '1.1rem',
            textTransform: 'none',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 8px rgba(0, 0, 0, 0.15)',
            },
            transition: 'all 0.2s ease-in-out',
          }}
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
            sx={{ 
              borderRadius: '12px',
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              textTransform: 'none',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 8px rgba(0, 0, 0, 0.15)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            Analyze Quality
          </Button>
        )}
      </Box>

      {audioFile && (
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="subtitle1" 
            gutterBottom 
            sx={{ 
              textAlign: 'center',
              color: '#4a5568',
              mb: 2,
            }}
          >
            Selected file: {audioFile.name}
          </Typography>
          <Box 
            sx={{ 
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div ref={waveformRef} />
          </Box>
        </Box>
      )}

      {isAnalyzing && (
        <Fade in={true}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 4 }}>
            <CircularProgress size={24} />
            <Typography sx={{ color: '#4a5568' }}>Analyzing audio quality...</Typography>
          </Box>
        </Fade>
      )}

      {metrics && (
        <Fade in={true}>
          <Box>
            <Typography 
              variant="h6" 
              gutterBottom 
              sx={{ 
                textAlign: 'center',
                color: '#2c5282',
                mb: 3,
                fontWeight: 'bold',
              }}
            >
              Quality Analysis Results
            </Typography>
            <Box 
              sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, 
                gap: 3,
                '& > *': {
                  p: 2,
                  borderRadius: '12px',
                  background: 'rgba(74, 144, 226, 0.1)',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    background: 'rgba(74, 144, 226, 0.15)',
                    transform: 'translateY(-2px)',
                  },
                },
              }}
            >
              <Typography>Bitrate: {metrics.bitrate} kbps</Typography>
              <Typography>Sample Rate: {metrics.sampleRate} Hz</Typography>
              <Typography>Channels: {metrics.channels}</Typography>
              <Typography>Duration: {metrics.duration.toFixed(2)} seconds</Typography>
              <Typography sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                Quality Score: {metrics.qualityScore.toFixed(1)}/100
              </Typography>
            </Box>
          </Box>
        </Fade>
      )}
    </Paper>
  );
};

export default AudioQualityChecker; 
