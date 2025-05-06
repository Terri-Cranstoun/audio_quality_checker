import { CssBaseline, ThemeProvider, createTheme, Box } from '@mui/material';
import AudioQualityChecker from './components/AudioQualityChecker';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#4a90e2',
    },
    secondary: {
      main: '#2c5282',
    },
  },
  shape: {
    borderRadius: 16,
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          p: 2,
        }}
      >
        <AudioQualityChecker />
      </Box>
    </ThemeProvider>
  );
}

export default App;
