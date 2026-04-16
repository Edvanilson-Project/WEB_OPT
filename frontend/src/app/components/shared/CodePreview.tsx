"use client";

import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import CodeDialog from "@/app/components/shared/CodeDialog";
import ChildCard from "./ChildCard";

type Props = {
  component: React.ReactNode; // rendered UI component
  filePath: string; // file to fetch (via API route)
  title?: string;
  subtitle?: string;
};

export default function CodePreview({
  component,
  filePath,
  title,
  subtitle,
}: Props) {
  const [code, setCode] = useState("");

  useEffect(() => {
    fetch(`/api/code?file=${filePath}`)
      .then((res) => res.text())
      .then((text) => setCode(text))
      .catch((err) => console.error("Error loading code:", err));
  }, [filePath]);

  return (
    <>
      <ChildCard title={title} codeModel={<CodeDialog>{code}</CodeDialog>}>
        <Box>{component}</Box>
      </ChildCard>
    </>
  );
}
