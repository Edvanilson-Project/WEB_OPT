import { uniqueId } from "lodash";
import { IconRoute, IconLogin, IconAppWindow } from "@tabler/icons-react";
import { NavGroup } from "@/app/(DashboardLayout)/types/layout/sidebar";

const Menuitems: NavGroup[] = [
  {
    navlabel: true,
    subheader: "Operações OTIMIZ",
  },
  {
    id: uniqueId(),
    title: "Viagens",
    icon: IconRoute,
    href: "/apps/trips",
  },
  {
    navlabel: true,
    subheader: "Acesso",
  },
  {
    id: uniqueId(),
    title: "Logout",
    icon: IconLogin,
    href: "/auth/auth1/login",
  }
];

export default Menuitems;
