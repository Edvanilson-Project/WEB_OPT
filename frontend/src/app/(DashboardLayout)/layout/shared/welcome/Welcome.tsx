import * as React from 'react';
import { Snackbar, Alert, AlertTitle, SnackbarCloseReason } from '@mui/material';

const Welcome = () => {
  const [open, setOpen] = React.useState(false);

  const handleClick = () => {
    setOpen(true);
  };

  const handleSnackbarClose = (event: React.SyntheticEvent | Event, reason: SnackbarCloseReason) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };


  const handleAlertClose = (event: React.SyntheticEvent) => {
    setOpen(false);
  };

  React.useEffect(() => {

    const timer = setTimeout(() => {
      handleClick();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <React.Fragment>
      <Snackbar
        open={open}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert
          onClose={handleAlertClose}
          severity="info"
          variant="filled"
          sx={{ width: '100%', color: 'white' }}
        >
          <AlertTitle>Welcome To Modernize</AlertTitle>
          Easy to customize the Template!!!
        </Alert>
      </Snackbar>
    </React.Fragment>
  );
};

export default Welcome;
