"use client";
import React from "react";
import { Box, styled, Container } from "@mui/material";
import dynamic from "next/dynamic";
import Header from "./layout/vertical/header/Header";

const Sidebar = dynamic(() => import("./layout/vertical/sidebar/Sidebar"), {
  ssr: false,
});

const MainWrapper = styled("div")(() => ({
  display: "flex",
  minHeight: "100vh",
  width: "100%",
}));

const PageWrapper = styled("div")(() => ({
  display: "flex",
  flexGrow: 1,
  paddingBottom: "60px",
  flexDirection: "column",
  zIndex: 1,
  backgroundColor: "transparent",
}));

interface Props {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  return (
    <MainWrapper className="mainwrapper">
      <Sidebar />
      <PageWrapper className="page-wrapper">
        <Header />
        <Container
          sx={{
            paddingTop: "20px",
            maxWidth: "1200px !important",
          }}
        >
          <Box sx={{ minHeight: "calc(100vh - 170px)" }}>{children}</Box>
        </Container>
      </PageWrapper>
    </MainWrapper>
  );
}
