import { createTheme } from '@mui/material/styles';

// Cores personalizadas para o YuStream
const colors = {
  primary: {
    main: '#1976d2',
    light: '#42a5f5',
    dark: '#1565c0',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#dc004e',
    light: '#ff5983',
    dark: '#9a0036',
    contrastText: '#ffffff',
  },
  background: {
    default: '#0a0a0a',
    paper: '#1a1a1a',
  },
  text: {
    primary: '#ffffff',
    secondary: '#b0b0b0',
  },
  error: {
    main: '#f44336',
    light: '#e57373',
    dark: '#d32f2f',
  },
  warning: {
    main: '#ff9800',
    light: '#ffb74d',
    dark: '#f57c00',
  },
  info: {
    main: '#2196f3',
    light: '#64b5f6',
    dark: '#1976d2',
  },
  success: {
    main: '#4caf50',
    light: '#81c784',
    dark: '#388e3c',
  },
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    ...colors,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      lineHeight: 1.2,
      '@media (max-width:600px)': {
        fontSize: '2rem',
      },
      '@media (min-width:1920px)': {
        fontSize: '3rem',
      },
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
      '@media (max-width:600px)': {
        fontSize: '1.75rem',
      },
      '@media (min-width:1920px)': {
        fontSize: '2.5rem',
      },
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
      lineHeight: 1.4,
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
      '@media (min-width:1920px)': {
        fontSize: '2.25rem',
      },
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
      lineHeight: 1.4,
      '@media (max-width:600px)': {
        fontSize: '1.25rem',
      },
      '@media (min-width:1920px)': {
        fontSize: '2rem',
      },
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.5,
      '@media (max-width:600px)': {
        fontSize: '1.1rem',
      },
      '@media (min-width:1920px)': {
        fontSize: '1.75rem',
      },
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.6,
      '@media (max-width:600px)': {
        fontSize: '0.9rem',
      },
      '@media (min-width:1920px)': {
        fontSize: '1.5rem',
      },
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
      '@media (max-width:600px)': {
        fontSize: '0.9rem',
      },
      '@media (min-width:1920px)': {
        fontSize: '1.25rem',
      },
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43,
      '@media (max-width:600px)': {
        fontSize: '0.8rem',
      },
      '@media (min-width:1920px)': {
        fontSize: '1.1rem',
      },
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
      '@media (max-width:600px)': {
        fontSize: '0.875rem',
      },
      '@media (min-width:1920px)': {
        fontSize: '1.1rem',
      },
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
          padding: '8px 16px',
          '@media (max-width:600px)': {
            padding: '6px 12px',
            fontSize: '0.875rem',
          },
          '@media (min-width:1920px)': {
            padding: '12px 24px',
            fontSize: '1.1rem',
          },
        },
        contained: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          },
        },
        sizeSmall: {
          '@media (max-width:600px)': {
            padding: '4px 8px',
            fontSize: '0.8rem',
          },
        },
        sizeLarge: {
          '@media (min-width:1920px)': {
            padding: '16px 32px',
            fontSize: '1.2rem',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background.paper,
          border: `1px solid rgba(255, 255, 255, 0.1)`,
          borderRadius: 12,
          '@media (max-width:600px)': {
            borderRadius: 8,
          },
          '@media (min-width:1920px)': {
            borderRadius: 16,
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '@media (max-width:600px)': {
              borderRadius: 6,
            },
            '@media (min-width:1920px)': {
              borderRadius: 12,
            },
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.2)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.3)',
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.primary.main,
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          '@media (max-width:600px)': {
            borderRadius: 12,
            fontSize: '0.75rem',
          },
          '@media (min-width:1920px)': {
            borderRadius: 20,
            fontSize: '0.9rem',
          },
        },
        sizeSmall: {
          '@media (max-width:600px)': {
            height: 24,
            fontSize: '0.7rem',
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiSnackbarContent-root': {
            borderRadius: 8,
          },
        },
      },
    },
  },
});

export default theme;
