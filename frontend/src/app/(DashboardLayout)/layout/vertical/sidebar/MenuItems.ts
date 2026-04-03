import { uniqueId } from "lodash";

interface MenuitemsType {
  [x: string]: any;
  id?: string;
  navlabel?: boolean;
  subheader?: string;
  title?: string;
  icon?: any;
  href?: string;
  children?: MenuitemsType[];
  chip?: string;
  chipColor?: string;
  variant?: string;
  external?: boolean;
}

import {
  IconChartPie,
  IconPlayerPlay,
  IconRoute,
  IconMap,
  IconBus,
  IconReportAnalytics,
  IconBuilding,
  IconUsers,
  IconClock,
  IconSettings,
} from "@tabler/icons-react";

const Menuitems: MenuitemsType[] = [
  {
    navlabel: true,
    subheader: "OTIMIZ",
  },
  {
    id: uniqueId(),
    title: "Dashboard",
    icon: IconChartPie,
    href: "/otimiz/dashboard",
  },
  {
    id: uniqueId(),
    title: "Motor de Otimização",
    icon: IconPlayerPlay,
    href: "/otimiz/optimization",
  },
  {
    id: uniqueId(),
    title: "Linhas",
    icon: IconRoute,
    href: "/otimiz/lines",
  },
  {
    id: uniqueId(),
    title: "Terminais",
    icon: IconMap,
    href: "/otimiz/terminals",
  },
  {
    id: uniqueId(),
    title: "Frota",
    icon: IconBus,
    href: "/otimiz/vehicles",
  },
  {
    id: uniqueId(),
    title: "Viagens",
    icon: IconClock,
    href: "/otimiz/trips",
  },
  {
    id: uniqueId(),
    title: "Relatórios",
    icon: IconReportAnalytics,
    href: "/otimiz/reports",
  },
  {
    id: uniqueId(),
    title: "Configurações",
    icon: IconSettings,
    href: "/otimiz/settings",
  },
  {
    navlabel: true,
    subheader: "Administração",
  },
  {
    id: uniqueId(),
    title: "Empresas",
    icon: IconBuilding,
    href: "/otimiz/companies",
  },
  {
    id: uniqueId(),
    title: "Usuários",
    icon: IconUsers,
    href: "/otimiz/users",
  },
];

export default Menuitems;
