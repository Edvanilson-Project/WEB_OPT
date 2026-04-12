"use client";

import { useEffect } from "react";
import { Box, Button, Typography, Paper } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

export default function OtimizError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Otimiz module error:", error);
  }, [error]);

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="50vh"
    >
      <Paper sx={{ p: 4, textAlign: "center", maxWidth: 480 }}>
        <ErrorOutlineIcon color="error" sx={{ fontSize: 48, mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Erro no módulo
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {error.message || "Um erro inesperado ocorreu nesta página."}
        </Typography>
        <Button variant="contained" onClick={reset}>
          Tentar novamente
        </Button>
      </Paper>
    </Box>
  );
}
