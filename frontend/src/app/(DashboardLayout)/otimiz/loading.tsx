import { Box, Skeleton, Stack } from "@mui/material";

export default function OtimizLoading() {
  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Skeleton variant="text" width={260} height={40} />
        <Skeleton variant="text" width={420} height={20} />

        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={96}
              sx={{ flex: 1 }}
            />
          ))}
        </Stack>

        <Skeleton variant="rounded" height={360} sx={{ mt: 2 }} />
        <Skeleton variant="rounded" height={240} />
      </Stack>
    </Box>
  );
}
