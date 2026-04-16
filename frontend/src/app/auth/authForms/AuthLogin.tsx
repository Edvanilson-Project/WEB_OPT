'use client'
import React, { useState } from "react";
import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Button,
  Stack,
  Divider,
  Alert,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginType } from "@/app/(DashboardLayout)/types/auth/auth";
import { Checkbox } from "@mui/material";
import CustomTextField from "@/app/components/forms/theme-elements/CustomTextField";
import CustomFormLabel from "@/app/components/forms/theme-elements/CustomFormLabel";
import axios from "../../../utils/axios";

/**
 * Componente de Formulário de Login (SRP: Responsável pela captura de credenciais e comunicação com o Auth backend).
 */
const AuthLogin = ({ title, subtitle, subtext }: loginType) => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Submete as credenciais para o NestJS. O token será recebido via HTTP-Only Cookie.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await axios.post("/auth/login", { email, password });
      
      // Salva dados básicos para exibição na UI (O token real está no Cookie)
      if (response.data?.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }

      // Se sucesso, redireciona para o dashboard principal
      router.push("/");
    } catch (err: any) {
      setError(err?.message || "Falha ao realizar login. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {title ? (
        <Typography fontWeight="700" variant="h3" mb={1}>
          {title}
        </Typography>
      ) : null}

      {subtext}

      <Box mt={3}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
      </Box>

      <Stack>
        <Box>
          <CustomFormLabel htmlFor="email">Email</CustomFormLabel>
          <CustomTextField 
            id="email" 
            variant="outlined" 
            fullWidth 
            value={email}
            onChange={(e: any) => setEmail(e.target.value)}
            required
          />
        </Box>
        <Box mt={2}>
          <CustomFormLabel htmlFor="password">Senha</CustomFormLabel>
          <CustomTextField
            id="password"
            type="password"
            variant="outlined"
            fullWidth
            value={password}
            onChange={(e: any) => setPassword(e.target.value)}
            required
          />
        </Box>
        <Stack
          justifyContent="space-between"
          direction="row"
          alignItems="center"
          my={2}
        >
          <FormGroup>
            <FormControlLabel
              control={<Checkbox defaultChecked />}
              label="Lembrar dispositivo"
            />
          </FormGroup>
          <Typography
            component={Link}
            href="/auth/auth1/forgot-password"
            fontWeight="500"
            sx={{
              textDecoration: "none",
              color: "primary.main",
            }}
          >
            Esqueceu a senha?
          </Typography>
        </Stack>
      </Stack>
      <Box>
        <Button
          color="primary"
          variant="contained"
          size="large"
          fullWidth
          type="submit"
          disabled={loading}
        >
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </Box>
      {subtitle}
    </form>
  );
};

export default AuthLogin;
