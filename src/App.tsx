import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
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
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AudioQualityChecker />
    </ThemeProvider>
  );
}

export default App;
