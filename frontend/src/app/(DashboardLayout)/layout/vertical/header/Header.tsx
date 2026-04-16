import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import useMediaQuery from "@mui/material/useMediaQuery";
import { styled } from "@mui/material/styles";
import { IconMenu2, IconMoon, IconSun } from "@tabler/icons-react";
import Search from "./Search";
import Profile from "./Profile";
import Language from "./Language";
import { CustomizerContext } from '@/app/context/customizerContext';
import config from '@/app/context/config'
import { useContext, useEffect, useState } from "react";
import { Typography, Chip, useTheme } from "@mui/material";

const Header = () => {
  const lgUp = useMediaQuery((theme) => theme.breakpoints.up("lg"));
  const lgDown = useMediaQuery((theme) => theme.breakpoints.down("lg"));
  const TopbarHeight = config.topbarHeight;
  const theme = useTheme();

  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCompanyName(user.companyName || "");
      } catch (e) {
        console.error("Erro ao ler user do localStorage", e);
      }
    }
  }, []);

  // drawer
  const { isSidebarHover, activeMode, setActiveMode, setIsCollapse, isCollapse, setIsSidebarHover, isMobileSidebar, setIsMobileSidebar } = useContext(CustomizerContext);

  const AppBarStyled = styled(AppBar)(({ theme }) => ({
    boxShadow: "none",
    background: theme.palette.background.paper,
    justifyContent: "center",
    backdropFilter: "blur(4px)",
    [theme.breakpoints.up("lg")]: {
      minHeight: TopbarHeight,
    },
  }));
  const ToolbarStyled = styled(Toolbar)(({ theme }) => ({
    width: "100%",
    color: theme.palette.text.secondary,
  }));

  return (
      <AppBarStyled position="sticky" color="default">
        <ToolbarStyled>
          {/* ------------------------------------------- */}
          {/* Toggle Button Sidebar */}
          {/* ------------------------------------------- */}

          <IconButton
            color="inherit"
            aria-label="menu"
            onClick={() => {
              // Toggle sidebar on both mobile and desktop based on screen size
              if (lgUp) {
                // For large screens, toggle between full-sidebar and mini-sidebar
                isCollapse === "full-sidebar" ? setIsCollapse("mini-sidebar") : setIsCollapse("full-sidebar");
              } else {
                // For smaller screens, toggle mobile sidebar
                setIsMobileSidebar(!isMobileSidebar);
              }
            }}
          >
            <IconMenu2 size="20" />
          </IconButton>
          {/* ------------------------------------------- */}
          {/* Search Dropdown */}
          {/* ------------------------------------------- */}
          <Search />

          {companyName && (
            <Chip 
              label={companyName} 
              color="primary" 
              variant="outlined" 
              sx={{ ml: 2, fontWeight: 600, borderRadius: '6px' }} 
            />
          )}

          <Box flexGrow={1} />
          <Stack spacing={1} direction="row" alignItems="center">
            <Language />

            <IconButton size="large" color="inherit">
              {activeMode === "light" ? (
                <IconMoon
                  size="21"
                  stroke="1.5"
                  onClick={() => setActiveMode("dark")}
                />
              ) : (
                <IconSun
                  size="21"
                  stroke="1.5"
                  onClick={() => setActiveMode("light")}
                />
              )}
            </IconButton>

            <Profile />
          </Stack>
        </ToolbarStyled>
      </AppBarStyled>
  );
};

export default Header;


