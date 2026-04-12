"use client";

import { useEffect } from "react";
import { Box, Button, Typography } from "@mui/material";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="60vh"
      gap={2}
    >
      <Typography variant="h4" color="error">
        Algo deu errado
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Ocorreu um erro inesperado. Tente novamente.
      </Typography>
      <Button variant="contained" onClick={reset}>
        Tentar novamente
      </Button>
    </Box>
  );
}
