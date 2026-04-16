import {
  IconAperture,
  IconSettings,
  IconRoute,
  IconUsers,
  IconAdjustmentsHorizontal,
  IconUpload,
} from "@tabler/icons-react";
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

const Menuitems: MenuitemsType[] = [
  {
    navlabel: true,
    subheader: "Operação",
  },
  {
    id: uniqueId(),
    title: "Dashboard",
    icon: IconAperture,
    href: "/",
  },
  {
    id: uniqueId(),
    title: "Ingestão de Dados",
    icon: IconUpload,
    href: "/operations/data",
  },
  {
    id: uniqueId(),
    title: "Gantt Planner",
    icon: IconRoute,
    href: "/operations/gantt",
  },
  {
    navlabel: true,
    subheader: "Configurações",
  },
  {
    id: uniqueId(),
    title: "Parâmetros CCT",
    icon: IconAdjustmentsHorizontal,
    href: "/settings/parameters",
  },
  {
    id: uniqueId(),
    title: "Usuários",
    icon: IconUsers,
    href: "/settings/users",
  },
  {
    id: uniqueId(),
    title: "Ajustes",
    icon: IconSettings,
    href: "/settings/general",
  },
];

export default Menuitems;
