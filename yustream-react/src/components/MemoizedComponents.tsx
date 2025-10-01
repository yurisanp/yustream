import { memo } from 'react';
import { Chip, CircularProgress } from '@mui/material';
import { Wifi, WifiOff } from '@mui/icons-material';

interface StreamStatusChipProps {
  isOnline: boolean;
  isMobile: boolean;
}

export const StreamStatusChip = memo(({ isOnline, isMobile }: StreamStatusChipProps) => (
  <Chip
    icon={isOnline ? <Wifi color="success" /> : <WifiOff color="error" />}
    label={
      isMobile
        ? isOnline ? "Online" : "Offline"
        : isOnline ? "Stream Online" : "Stream Offline"
    }
    color={isOnline ? "success" : "error"}
    size="small"
    variant="outlined"
    sx={{ fontSize: { xs: "0.7rem", sm: "0.75rem" } }}
  />
));

StreamStatusChip.displayName = 'StreamStatusChip';

interface LoadingChipProps {
  isMobile: boolean;
}

export const LoadingChip = memo(({ isMobile }: LoadingChipProps) => (
  <Chip
    icon={<CircularProgress size={16} color="primary" />}
    label={isMobile ? "..." : "Verificando..."}
    color="info"
    size="small"
    variant="outlined"
    sx={{ fontSize: { xs: "0.7rem", sm: "0.75rem" } }}
  />
));

LoadingChip.displayName = 'LoadingChip';

interface StatusIconProps {
  status: string;
}

export const StatusIcon = memo(({ status }: StatusIconProps) => {
  switch (status) {
    case "connecting":
      return <CircularProgress size={24} color="primary" />;
    case "playing":
      return <Wifi color="success" />;
    case "offline":
      return <WifiOff color="warning" />;
    case "error":
      return <WifiOff color="error" />;
    default:
      return <Wifi color="action" />;
  }
});

StatusIcon.displayName = 'StatusIcon';
