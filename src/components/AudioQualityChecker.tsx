import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, Typography, Paper, CircularProgress, Fade, Slider, Switch, FormControlLabel } from '@mui/material';
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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [filterSpeech, setFilterSpeech] = useState(false);
  const [trimPauses, setTrimPauses] = useState(false);
  const [processedAudioUrl, setProcessedAudioUrl] = useState<string>('');
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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
        interact: true,
      });

      wavesurferRef.current.load(audioUrl);

      wavesurferRef.current.on('audioprocess', (time: number) => {
        setCurrentTime(time);
      });

      wavesurferRef.current.on('ready', () => {
        setDuration(wavesurferRef.current?.getDuration() || 0);
      });

      wavesurferRef.current.on('play', () => {
        setIsPlaying(true);
      });

      wavesurferRef.current.on('pause', () => {
        setIsPlaying(false);
      });

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
      setProcessedAudioUrl('');
    }
  };

  const calculateQualityScore = (audioBuffer: AudioBuffer, bitrate: number): number => {
    let score = 0;
    const maxScore = 100;

    // Frequency range score (250Hz - 4000Hz)
    const minFreq = 250;
    const maxFreq = 4000;
    const sampleRate = audioBuffer.sampleRate;
    
    // Calculate frequency score (50 points)
    if (sampleRate >= minFreq * 2 && sampleRate <= maxFreq * 2) {
      // Perfect score if within range
      score += 50;
    } else if (sampleRate < minFreq * 2) {
      // Linear decrease below minimum frequency
      score += (sampleRate / (minFreq * 2)) * 50;
    } else {
      // Linear decrease above maximum frequency
      score += ((maxFreq * 2) / sampleRate) * 50;
    }

    // Bitrate score (30 points)
    const minBitrate = 128;
    const maxBitrate = 320;
    if (bitrate >= minBitrate && bitrate <= maxBitrate) {
      // Perfect score if within range
      score += 30;
    } else if (bitrate < minBitrate) {
      // Linear decrease below minimum bitrate
      score += (bitrate / minBitrate) * 30;
    } else {
      // Linear decrease above maximum bitrate
      score += (maxBitrate / bitrate) * 30;
    }

    // Channels score (20 points)
    const channels = audioBuffer.numberOfChannels;
    if (channels === 2) {
      // Perfect score for stereo
      score += 20;
    } else if (channels === 1) {
      // Half score for mono
      score += 10;
    }

    return Math.min(maxScore, Math.round(score));
  };

  const processAudio = async () => {
    if (!audioFile) return;

    setIsAnalyzing(true);
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;

    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Create a new buffer for processing
      const processedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );

      // Process each channel
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const inputData = audioBuffer.getChannelData(channel);
        const outputData = processedBuffer.getChannelData(channel);

        // Apply speech frequency filter (300Hz - 3400Hz)
        if (filterSpeech) {
          const biquadFilter = audioContext.createBiquadFilter();
          biquadFilter.type = 'bandpass';
          biquadFilter.frequency.value = 1850; // Center frequency
          biquadFilter.Q.value = 1.0; // Quality factor

          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(biquadFilter);
          biquadFilter.connect(audioContext.destination);

          // Get the filtered data
          const filteredData = new Float32Array(inputData.length);
          const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
          );
          const offlineSource = offlineContext.createBufferSource();
          offlineSource.buffer = audioBuffer;
          offlineSource.connect(offlineContext.destination);
          offlineSource.start();
          const renderedBuffer = await offlineContext.startRendering();
          renderedBuffer.copyToChannel(renderedBuffer.getChannelData(channel), channel);
        }

        // Trim pauses (remove sections with very low amplitude)
        if (trimPauses) {
          const threshold = 0.01; // Adjust this value to control sensitivity
          let isPause = false;
          let pauseStart = 0;

          for (let i = 0; i < inputData.length; i++) {
            if (Math.abs(inputData[i]) < threshold) {
              if (!isPause) {
                isPause = true;
                pauseStart = i;
              }
            } else {
              if (isPause && i - pauseStart > audioBuffer.sampleRate * 0.5) { // 0.5 second minimum pause
                // Remove the pause
                for (let j = pauseStart; j < i; j++) {
                  outputData[j] = 0;
                }
              }
              isPause = false;
              outputData[i] = inputData[i];
            }
          }
        }
      }

      // Convert processed buffer to blob and create URL
      const processedBlob = await bufferToWav(processedBuffer);
      const processedUrl = URL.createObjectURL(processedBlob);
      setProcessedAudioUrl(processedUrl);

      // Update waveform with processed audio
      if (wavesurferRef.current) {
        wavesurferRef.current.load(processedUrl);
      }

      // Calculate bitrate
      const bitrate = Math.round((audioFile.size / processedBuffer.duration) * 8 / 1000);

      // Calculate quality metrics
      const qualityScore = calculateQualityScore(processedBuffer, bitrate);
      setMetrics({
        bitrate,
        sampleRate: processedBuffer.sampleRate,
        channels: processedBuffer.numberOfChannels,
        duration: processedBuffer.duration,
        qualityScore,
      });

    } catch (error) {
      console.error('Error processing audio:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const bufferToWav = async (buffer: AudioBuffer): Promise<Blob> => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const wav = new ArrayBuffer(44 + buffer.length * blockAlign);
    const view = new DataView(wav);

    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + buffer.length * blockAlign, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, buffer.length * blockAlign, true);

    // Write audio data
    const offset = 44;
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset + i * 2, sample * 0x7FFF, true);
    }

    return new Blob([wav], { type: 'audio/wav' });
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ display: 'flex', gap: 4, maxWidth: 1200, width: '100%' }}>
      <Paper 
        elevation={6} 
        sx={{ 
          p: 4,
          flex: 1,
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
              onClick={processAudio}
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
              Process Audio
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
              <Typography sx={{ color: '#4a5568' }}>Processing audio...</Typography>
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
                  Quality Score: {metrics.qualityScore}/100
                </Typography>
              </Box>
              {processedAudioUrl && (
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = processedAudioUrl;
                      link.download = `processed_${audioFile?.name || 'audio'}.wav`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
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
                    Download Processed Audio
                  </Button>
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ mt: 1 }}
                  >
                    {filterSpeech && trimPauses ? 'Download audio with speech frequencies filtered and pauses trimmed' :
                     filterSpeech ? 'Download audio with speech frequencies filtered' :
                     trimPauses ? 'Download audio with pauses trimmed' :
                     'Download processed audio'}
                  </Typography>
                </Box>
              )}
            </Box>
          </Fade>
        )}
      </Paper>

      <Paper 
        elevation={6} 
        sx={{ 
          p: 4,
          width: 300,
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Typography 
          variant="h5" 
          gutterBottom 
          sx={{ 
            textAlign: 'center',
            mb: 3,
            fontWeight: 'bold',
            color: '#2c5282',
          }}
        >
          Audio Controls
        </Typography>

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={filterSpeech}
                onChange={(e) => setFilterSpeech(e.target.checked)}
                color="primary"
              />
            }
            label="Filter Speech Frequencies"
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Removes frequencies outside human speech range (300Hz - 3400Hz)
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={trimPauses}
                onChange={(e) => setTrimPauses(e.target.checked)}
                color="primary"
              />
            }
            label="Trim Pauses"
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Removes silent sections longer than 0.5 seconds
          </Typography>
        </Box>

        {audioFile && (
          <Box sx={{ mt: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">{formatTime(currentTime)}</Typography>
              <Typography variant="body2">{formatTime(duration)}</Typography>
            </Box>
            <Slider
              value={currentTime}
              max={duration}
              onChange={(_, value) => {
                if (wavesurferRef.current) {
                  wavesurferRef.current.seekTo(value as number / duration);
                }
              }}
              sx={{
                color: '#4a90e2',
                '& .MuiSlider-thumb': {
                  width: 12,
                  height: 12,
                },
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="contained"
                onClick={() => {
                  if (wavesurferRef.current) {
                    wavesurferRef.current.playPause();
                  }
                }}
                sx={{ 
                  borderRadius: '50%',
                  minWidth: 48,
                  height: 48,
                  p: 0,
                }}
              >
                {isPlaying ? '⏸' : '▶'}
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default AudioQualityChecker; 
